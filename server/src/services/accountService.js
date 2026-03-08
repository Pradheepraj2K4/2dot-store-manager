// LedgerTypeService — manages custom ledger types (formerly AccountService)
const ledgerTypeRepository = require('../repositories/accountRepository');
const { AppError } = require('../middleware/errorHandler');

class LedgerTypeService {
  getAllTypes() {
    return ledgerTypeRepository.findAll();
  }

  getTypeById(id) {
    const lt = ledgerTypeRepository.findById(id);
    if (!lt) throw new AppError('Ledger type not found', 404);
    return lt;
  }

  createType(data) {
    const { name, behaviour } = data;
    if (!name || name.trim().length === 0) throw new AppError('Name is required', 400);
    if (!behaviour || !['customer', 'supplier'].includes(behaviour)) {
      throw new AppError('Behaviour must be "customer" or "supplier"', 400);
    }
    const existing = ledgerTypeRepository.findByName(name.trim());
    if (existing) throw new AppError('A ledger type with this name already exists', 400);
    return ledgerTypeRepository.create({ name: name.trim(), behaviour });
  }

  updateType(id, data) {
    const existing = ledgerTypeRepository.findById(id);
    if (!existing) throw new AppError('Ledger type not found', 404);
    if (existing.is_system) throw new AppError('System ledger types cannot be modified', 400);
    if (!data.name || data.name.trim().length === 0) throw new AppError('Name is required', 400);
    if (!data.behaviour || !['customer', 'supplier'].includes(data.behaviour)) {
      throw new AppError('Behaviour must be "customer" or "supplier"', 400);
    }
    return ledgerTypeRepository.update(id, { name: data.name.trim(), behaviour: data.behaviour });
  }

  deleteType(id) {
    const existing = ledgerTypeRepository.findById(id);
    if (!existing) throw new AppError('Ledger type not found', 404);
    if (existing.is_system) throw new AppError('System ledger types cannot be deleted', 400);
    const inUse = ledgerTypeRepository.countLedgers(id);
    if (inUse > 0) throw new AppError(`Cannot delete "${existing.name}" — ${inUse} ledger${inUse !== 1 ? 's are' : ' is'} using this type`, 400);
    ledgerTypeRepository.delete(id);
    return { message: 'Ledger type deleted successfully' };
  }
}

module.exports = new LedgerTypeService();
