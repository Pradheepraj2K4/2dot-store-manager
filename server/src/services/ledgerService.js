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
    return ledgerRepository.update(id, { ...data, name: data.name.trim() });
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
}

module.exports = new LedgerService();
