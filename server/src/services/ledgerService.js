const ledgerRepository = require('../repositories/ledgerRepository');
const ledgerTypeRepository = require('../repositories/accountRepository');
const settingsRepository = require('../repositories/settingsRepository');
const { AppError } = require('../middleware/errorHandler');

class LedgerService {
  isInterestEnabled() {
    const val = settingsRepository.get('interest_module_enabled');
    return val === true || val === 'true';
  }

  getAllLedgers(filters = {}) {
    return ledgerRepository.findAll(filters);
  }

  getLedgerById(id) {
    const ledger = ledgerRepository.findById(id);
    if (!ledger) throw new AppError('Ledger not found', 404);
    return ledger;
  }

  createLedger(data) {
    const { ledger_type_id, name, igst_status } = data;
    if (!ledger_type_id) throw new AppError('Ledger type is required', 400);
    const lt = ledgerTypeRepository.findById(ledger_type_id);
    if (!lt) throw new AppError('Invalid ledger type', 400);
    if (!name || name.trim().length === 0) throw new AppError('Ledger name is required.', 400);
    if (igst_status && !['YES', 'NO'].includes(igst_status)) {
      throw new AppError('IGST Status must be "YES" or "NO".', 400);
    }

    let rate = 0;
    let scheme = 'NONE';
    if (this.isInterestEnabled()) {
      rate = parseFloat(data.interest_rate) || 0;
      scheme = data.interest_scheme || 'NONE';
      if (!['NONE', 'DAILY', 'MONTHLY'].includes(scheme)) throw new AppError('Invalid interest scheme', 400);
      if (rate < 0) throw new AppError('Interest rate cannot be negative', 400);
    }

    return ledgerRepository.create({
      ...data,
      name: name.trim(),
      interest_rate: rate,
      interest_scheme: scheme,
    });
  }

  updateLedger(id, data) {
    const existing = ledgerRepository.findById(id);
    if (!existing) throw new AppError('Ledger not found', 404);
    if (!data.name || data.name.trim().length === 0) throw new AppError('Ledger name is required.', 400);
    if (!data.ledger_type_id) throw new AppError('Ledger type is required', 400);

    const updateData = { ...data, name: data.name.trim() };
    // Opening balance can only be set/changed while the current balance is exactly 0
    // (i.e. the ledger has no posted transactions affecting it).
    if (data.opening_balance !== undefined && data.opening_balance !== null && data.opening_balance !== '') {
      if (existing.current_balance !== 0) {
        throw new AppError('Opening balance can only be changed when the current balance is 0.', 400);
      }
      updateData.opening_balance = parseFloat(data.opening_balance) || 0;
    } else {
      delete updateData.opening_balance;
    }
    return ledgerRepository.update(id, updateData);
  }

  deleteLedger(id) {
    const existing = ledgerRepository.findById(id);
    if (!existing) throw new AppError('Ledger not found', 404);
    ledgerRepository.delete(id);
    return { message: 'Ledger deleted successfully' };
  }

  searchLedgers(query) {
    if (!query || query.trim().length === 0) return ledgerRepository.findAll();
    return ledgerRepository.search(query.trim());
  }

  getLedgerCounts() {
    return ledgerRepository.count();
  }

  getAllWithOutstanding() {
    return ledgerRepository.getAllWithOutstanding();
  }

  getOutstandingByType(ledgerTypeId) {
    return ledgerRepository.getOutstandingByType(ledgerTypeId);
  }

  getLedgersWithPendingInterest() {
    return ledgerRepository.getWithPendingInterest();
  }

  bulkCreateLedgers(items) {
    const results = { created: 0, skipped: 0, errors: [] };
    for (const item of items) {
      try {
        this.createLedger(item);
        results.created++;
      } catch (err) {
        results.skipped++;
        results.errors.push({ name: item.name, reason: err.message });
      }
    }
    return results;
  }

  getCashLedger() {
    return ledgerRepository.findCash();
  }
}

module.exports = new LedgerService();
