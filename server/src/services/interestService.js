const interestRepository = require('../repositories/interestRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const settingsRepository = require('../repositories/settingsRepository');
const { AppError } = require('../middleware/errorHandler');

class InterestService {
  isModuleEnabled() {
    const val = settingsRepository.get('interest_module_enabled');
    return val === true || val === 'true';
  }

  /**
   * Generate interest entries for a single ledger up to a given date (or today).
   * DAILY:   current_balance × rate/100  per day   (rate = daily %)
   * MONTHLY: current_balance × rate/100  per month (rate = monthly %)
   */
  generateForLedger(ledgerId, upToDate = null) {
    if (!this.isModuleEnabled()) return [];

    const ledger = ledgerRepository.findById(ledgerId);
    if (!ledger) throw new AppError('Ledger not found', 404);
    if (ledger.interest_scheme === 'NONE' || ledger.interest_rate <= 0) return [];
    if (ledger.current_balance <= 0) return [];

    const today = upToDate || this._todayISO();
    const lastToDate = interestRepository.getLastEntryToDate(ledgerId);

    let startDate;
    if (lastToDate) {
      startDate = this._nextDay(lastToDate);
    } else if (ledger.ledger_date) {
      startDate = ledger.ledger_date;
    } else {
      startDate = ledger.created_at
        ? ledger.created_at.split(' ')[0].split('T')[0]
        : today;
    }

    if (startDate > today) return [];

    const entries = [];
    const principal = ledger.current_balance;
    const rate = ledger.interest_rate;

    if (ledger.interest_scheme === 'DAILY') {
      // One entry per calendar day: daily_amount = principal × rate/100
      let current = startDate;
      while (current <= today) {
        if (!interestRepository.existsForPeriod(ledgerId, current, current)) {
          const amount = Math.round((principal * rate / 100) * 100) / 100;
          entries.push({
            ledger_id: ledgerId,
            amount,
            from_date: current,
            to_date: current,
            days: 1,
            rate,
            principal_at_time: principal,
          });
        }
        current = this._nextDay(current);
      }
    } else if (ledger.interest_scheme === 'MONTHLY') {
      let current = startDate;
      while (current <= today) {
        const monthEnd = this._endOfMonth(current);
        const periodEnd = monthEnd <= today ? monthEnd : today;
        const periodDays = this._dayDiff(current, periodEnd) + 1;

        if (periodDays > 0 && !interestRepository.existsForPeriod(ledgerId, current, periodEnd)) {
          const amount = Math.round((principal * rate / 100) * 100) / 100;
          entries.push({
            ledger_id: ledgerId,
            amount,
            from_date: current,
            to_date: periodEnd,
            days: periodDays,
            rate,
            principal_at_time: principal,
          });
        }

        current = this._firstOfNextMonth(current);
        if (current > today) break;
      }
    }

    if (entries.length > 0) {
      interestRepository.createMany(entries);
    }

    return interestRepository.findByLedgerId(ledgerId);
  }

  generateAll(upToDate = null) {
    if (!this.isModuleEnabled()) return { generated: 0 };

    const { getDb } = require('../db/database');
    const db = getDb();
    const ledgers = db.prepare(`
      SELECT id FROM ledgers
      WHERE interest_scheme != 'NONE' AND interest_rate > 0 AND status = 'active'
    `).all();

    let totalGenerated = 0;
    for (const l of ledgers) {
      const entries = this.generateForLedger(l.id, upToDate);
      totalGenerated += entries.length;
    }

    return { generated: totalGenerated };
  }

  getEntries(filters = {}) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);
    return interestRepository.findAll(filters);
  }

  getEntriesByLedger(ledgerId) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);

    const ledger = ledgerRepository.findById(ledgerId);
    if (!ledger) throw new AppError('Ledger not found', 404);

    this.generateForLedger(ledgerId);

    return interestRepository.findByLedgerId(ledgerId);
  }

  getPendingByLedger(ledgerId) {
    return interestRepository.getPendingByLedger(ledgerId);
  }

  getTotalPendingByLedger(ledgerId) {
    return interestRepository.getTotalPendingByLedger(ledgerId);
  }

  markPaid(id, paidDate = null, amount = null) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);
    const entry = interestRepository.findById(id);
    if (!entry) throw new AppError('Interest entry not found', 404);
    // Enforce sequential payment: no older pending entry must exist for this ledger
    const oldest = interestRepository.getPendingByLedger(entry.ledger_id)[0];
    if (!oldest || oldest.id !== entry.id)
      throw new AppError('Earlier interest entries must be paid first', 400);
    const parsedAmount = amount != null ? parseFloat(amount) : null;
    return interestRepository.markPaid(id, paidDate || this._todayISO(), isNaN(parsedAmount) ? null : parsedAmount);
  }

  /**
   * Bulk pay: distributes a given amount across pending entries (oldest first).
   * Fully-covered entries are marked paid. If the amount only partially covers
   * an entry, that entry is marked paid with the partial amount and a new
   * pending entry is created for the remainder (same period/rate details).
   */
  bulkPay(ledgerId, amount, paidDate) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);
    const pending = interestRepository.getPendingByLedger(ledgerId);
    if (!pending.length) throw new AppError('No pending interest entries', 400);

    const { getDb } = require('../db/database');
    const db = getDb();

    let remaining = Math.round(parseFloat(amount) * 100) / 100;
    let paidCount = 0;

    const run = db.transaction(() => {
      for (const entry of pending) {
        if (remaining <= 0) break;
        if (remaining >= entry.amount) {
          interestRepository.markPaid(entry.id, paidDate, entry.amount);
          remaining = Math.round((remaining - entry.amount) * 100) / 100;
          paidCount++;
        } else {
          const partialAmount   = Math.round(remaining * 100) / 100;
          const remainderAmount = Math.round((entry.amount - partialAmount) * 100) / 100;
          interestRepository.markPaid(entry.id, paidDate, partialAmount);
          interestRepository.create({
            ledger_id:          entry.ledger_id,
            amount:             remainderAmount,
            from_date:          entry.from_date,
            to_date:            entry.to_date,
            days:               entry.days,
            rate:               entry.rate,
            principal_at_time:  entry.principal_at_time,
          });
          paidCount++;
          remaining = 0;
        }
      }
    });

    run();
    return { paid_count: paidCount, leftover_amount: remaining };
  }

  deleteEntry(id) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);
    const entry = interestRepository.findById(id);
    if (!entry) throw new AppError('Interest entry not found', 404);
    if (entry.status !== 'paid') throw new AppError('Only paid entries can be reverted', 400);
    // Enforce sequential revert: only the most recently paid entry for this ledger can be reverted
    const db = require('../db/connection').getDb();
    const latest = db.prepare(
      "SELECT id FROM interest_entries WHERE ledger_id = ? AND status = 'paid' ORDER BY paid_date DESC, id DESC LIMIT 1"
    ).get(entry.ledger_id);
    if (!latest || latest.id !== entry.id)
      throw new AppError('Only the most recently paid entry can be reverted', 400);
    return interestRepository.unmarkPaid(id);
  }

  // ── Date utility helpers ─────────────────────────────────────────────────

  _todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _nextDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _endOfMonth(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  }

  _firstOfNextMonth(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const first = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`;
  }

  _dayDiff(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  _daysInMonth(dateStr) {
    const [y, m] = dateStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
}

module.exports = new InterestService();
