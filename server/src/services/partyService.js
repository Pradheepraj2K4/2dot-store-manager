const partyRepository = require('../repositories/partyRepository');
const { AppError } = require('../middleware/errorHandler');

class PartyService {
  getAllParties(type = null) {
    return partyRepository.findAll(type);
  }

  getPartyById(id) {
    const party = partyRepository.findById(id);
    if (!party) {
      throw new AppError('Party not found', 404);
    }
    return party;
  }

  createParty(data) {
    const { type, name, igst_status } = data;
    if (!type || !['customer', 'supplier'].includes(type)) {
      throw new AppError('Invalid party type. Must be "customer" or "supplier".', 400);
    }
    if (!name || name.trim().length === 0) {
      throw new AppError('Party name is required.', 400);
    }
    if (!igst_status || !['YES', 'NO'].includes(igst_status)) {
      throw new AppError('IGST Status is required. Must be "YES" or "NO".', 400);
    }
    if (data.interest_scheme && !['NONE', 'DAILY', 'MONTHLY'].includes(data.interest_scheme)) {
      throw new AppError('Interest scheme must be "NONE", "DAILY", or "MONTHLY".', 400);
    }
    return partyRepository.create({
      ...data,
      name: name.trim(),
      opening_balance: parseFloat(data.opening_balance) || 0,
      interest_rate: parseFloat(data.interest_rate) || 0,
      interest_scheme: data.interest_scheme || 'NONE',
    });
  }

  updateParty(id, data) {
    const existing = partyRepository.findById(id);
    if (!existing) {
      throw new AppError('Party not found', 404);
    }
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError('Party name is required.', 400);
    }
    if (!data.igst_status || !['YES', 'NO'].includes(data.igst_status)) {
      throw new AppError('IGST Status is required. Must be "YES" or "NO".', 400);
    }
    if (data.interest_scheme && !['NONE', 'DAILY', 'MONTHLY'].includes(data.interest_scheme)) {
      throw new AppError('Interest scheme must be "NONE", "DAILY", or "MONTHLY".', 400);
    }
    return partyRepository.update(id, {
      ...data,
      name: data.name.trim(),
      interest_rate: parseFloat(data.interest_rate) || 0,
      interest_scheme: data.interest_scheme || 'NONE',
    });
  }

  deleteParty(id) {
    const existing = partyRepository.findById(id);
    if (!existing) {
      throw new AppError('Party not found', 404);
    }
    partyRepository.delete(id);
    return { message: 'Party deleted successfully' };
  }

  searchParties(query) {
    if (!query || query.trim().length === 0) {
      return partyRepository.findAll();
    }
    return partyRepository.search(query.trim());
  }

  getPartyCounts() {
    return partyRepository.count();
  }
}

module.exports = new PartyService();
