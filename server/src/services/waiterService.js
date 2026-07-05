const waiterRepository = require('../repositories/waiterRepository');
const { AppError } = require('../middleware/errorHandler');

class WaiterService {
  getAll(filters) {
    return waiterRepository.getAll(filters);
  }

  getById(id) {
    const waiter = waiterRepository.getById(id);
    if (!waiter) throw new AppError('Waiter not found', 404);
    return waiter;
  }

  create(data) {
    const name = (data && data.name ? String(data.name) : '').trim();
    if (!name) throw new AppError('Waiter name is required', 400);
    return waiterRepository.create({ name });
  }

  update(id, data) {
    this.getById(id);
    const name = (data && data.name ? String(data.name) : '').trim();
    if (!name) throw new AppError('Waiter name is required', 400);
    const status = data.status === 'inactive' ? 'inactive' : 'active';
    return waiterRepository.update(id, { name, status });
  }

  delete(id) {
    this.getById(id);
    if (waiterRepository.countSales(id) > 0) {
      throw new AppError('Cannot delete a waiter that is linked to sales', 400);
    }
    return waiterRepository.delete(id);
  }

  setDefault(id, isDefault = true) {
    if (id) this.getById(id);
    // Passing isDefault=false (or the current default id again) clears it.
    return waiterRepository.setDefault(isDefault ? id : null);
  }
}

module.exports = new WaiterService();
