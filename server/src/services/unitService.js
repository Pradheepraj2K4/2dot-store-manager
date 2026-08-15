const unitRepository = require('../repositories/unitRepository');
const { AppError } = require('../middleware/errorHandler');

class UnitService {
  getAll(filters) {
    return unitRepository.getAll(filters);
  }

  getById(id) {
    const unit = unitRepository.getById(id);
    if (!unit) throw new AppError('Unit not found', 404);
    return unit;
  }

  create(data) {
    const name = (data && data.name ? String(data.name) : '').trim();
    if (!name) throw new AppError('Unit name is required', 400);
    if (unitRepository.getByName(name)) {
      throw new AppError('A unit with this name already exists', 400);
    }
    return unitRepository.create({ name });
  }

  update(id, data) {
    this.getById(id);
    const name = (data && data.name ? String(data.name) : '').trim();
    if (!name) throw new AppError('Unit name is required', 400);
    const existing = unitRepository.getByName(name);
    if (existing && existing.id !== id) {
      throw new AppError('A unit with this name already exists', 400);
    }
    return unitRepository.update(id, { name });
  }

  delete(id) {
    const unit = this.getById(id);
    if (unitRepository.countItems(unit.name) > 0) {
      throw new AppError('Cannot delete a unit that is used by items', 400);
    }
    return unitRepository.delete(id);
  }
}

module.exports = new UnitService();
