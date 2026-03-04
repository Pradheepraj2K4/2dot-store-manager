const interestRepository = require('../repositories/interestRepository');
const partyRepository = require('../repositories/partyRepository');
const transactionRepository = require('../repositories/transactionRepository');
const settingsRepository = require('../repositories/settingsRepository');
const { AppError } = require('../middleware/errorHandler');

class InterestService {
  /**
   * Check if the interest module is enabled in settings.
   */
  isModuleEnabled() {
    const val = settingsRepository.get('interest_module_enabled');
    return val === true || val === 'true';
  }

  /**
   * Generate interest entries for a party up to a given date (or today).
   * Only generates entries for dates that don't already have one.
   */
  generateEntries(partyId, upToDate = null) {
    if (!this.isModuleEnabled()) return [];

    const party = partyRepository.findById(partyId);
    if (!party) throw new AppError('Party not found', 404);
    if (party.interest_scheme === 'NONE' || party.interest_rate <= 0) return [];

    const today = upToDate || this._todayISO();
    const lastDate = interestRepository.getLastEntryDate(partyId);

    // Interest is always calculated on the opening balance (fixed principal)
    const principal = Math.abs(party.opening_balance);

    if (principal <= 0) return [];

    // Determine start date: day after the last entry, or the party creation date
    let startDate;
    if (lastDate) {
      startDate = this._nextDay(lastDate);
    } else {
      // Start from the party creation date (just date part)
      startDate = party.created_at ? party.created_at.split(' ')[0].split('T')[0] : today;
    }

    if (startDate > today) return [];

    const entries = [];

    if (party.interest_scheme === 'DAILY') {
      let current = startDate;
      while (current <= today) {
        if (!interestRepository.existsForDate(partyId, current)) {
          // Full rate% applied each day: e.g. 10% on 10,000 = 1,000 per day
          const interestAmount = Math.round((principal * party.interest_rate / 100) * 100) / 100;

          entries.push({
            party_id: partyId,
            date: current,
            principal,
            rate: party.interest_rate,
            scheme: 'DAILY',
            interest_amount: interestAmount,
            notes: '',
          });
        }
        current = this._nextDay(current);
      }
    } else if (party.interest_scheme === 'MONTHLY') {
      // Generate one entry per month
      let current = startDate;
      while (current <= today) {
        const monthEnd = this._endOfMonth(current);
        const entryDate = monthEnd <= today ? monthEnd : today;

        if (!interestRepository.existsForDate(partyId, entryDate)) {
          // Calculate days in this month period
          const daysInMonth = this._daysInMonth(current);
          const monthlyRate = party.interest_rate / 12;
          const interestAmount = Math.round((principal * monthlyRate / 100) * 100) / 100;

          entries.push({
            party_id: partyId,
            date: entryDate,
            principal,
            rate: party.interest_rate,
            scheme: 'MONTHLY',
            interest_amount: interestAmount,
            notes: '',
          });
        }

        // Move to first of next month
        current = this._firstOfNextMonth(current);
        if (current > today) break;
      }
    }

    if (entries.length > 0) {
      interestRepository.createMany(entries);
    }

    return interestRepository.findByPartyId(partyId);
  }

  /**
   * Generate entries for all parties that have interest configured.
   */
  generateAllEntries(upToDate = null) {
    if (!this.isModuleEnabled()) return { generated: 0 };

    const { getDb } = require('../db/database');
    const db = getDb();
    const parties = db.prepare(`
      SELECT id FROM parties
      WHERE interest_scheme != 'NONE' AND interest_rate > 0
    `).all();

    let totalGenerated = 0;
    for (const p of parties) {
      const entries = this.generateEntries(p.id, upToDate);
      totalGenerated += entries.length;
    }

    return { generated: totalGenerated };
  }

  /**
   * Get all interest entries with optional filters.
   */
  getEntries(filters = {}) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);
    return interestRepository.findAll(filters);
  }

  /**
   * Get interest entries for a specific party (auto-generates up to today if needed).
   */
  getEntriesByParty(partyId) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);

    const party = partyRepository.findById(partyId);
    if (!party) throw new AppError('Party not found', 404);

    // Auto-generate entries up to today
    this.generateEntries(partyId);

    return interestRepository.findByPartyId(partyId);
  }

  /**
   * Get summary of interest by party (for reports).
   */
  getSummary() {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);

    // Auto-generate for all parties first
    this.generateAllEntries();

    return interestRepository.getSummaryByParty();
  }

  /**
   * Adjust an interest entry (partial discount/reduction).
   */
  adjustEntry(id, { adjustment, notes }) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);

    const entry = interestRepository.findById(id);
    if (!entry) throw new AppError('Interest entry not found', 404);
    if (entry.status === 'waived') throw new AppError('Cannot adjust a waived entry', 400);

    const adj = parseFloat(adjustment);
    if (isNaN(adj) || adj < 0) throw new AppError('Adjustment must be a non-negative number', 400);
    if (adj > entry.interest_amount) throw new AppError('Adjustment cannot exceed interest amount', 400);

    const status = adj >= entry.interest_amount ? 'adjusted' : 'adjusted';

    return interestRepository.adjust(id, {
      adjustment: adj,
      notes: notes || '',
      status,
    });
  }

  /**
   * Waive an interest entry entirely.
   */
  waiveEntry(id, notes) {
    if (!this.isModuleEnabled()) throw new AppError('Interest module is not enabled', 400);

    const entry = interestRepository.findById(id);
    if (!entry) throw new AppError('Interest entry not found', 404);

    return interestRepository.waive(id, notes);
  }

  /**
   * Get total pending interest for a party.
   */
  getTotalPendingInterest(partyId) {
    return interestRepository.getTotalPendingInterest(partyId);
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

  _daysInMonth(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }
}

module.exports = new InterestService();
