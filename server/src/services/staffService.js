const staffRepository = require('../repositories/staffRepository');
const { AppError } = require('../middleware/errorHandler');

class StaffService {
  getAll(filters) {
    return staffRepository.getAll(filters);
  }

  getById(id) {
    const staff = staffRepository.getById(id);
    if (!staff) throw new AppError('Staff not found', 404);
    return staff;
  }

  create(data) {
    const name = (data && data.name ? String(data.name) : '').trim();
    if (!name) throw new AppError('Staff name is required', 400);
    return staffRepository.create({ name });
  }

  update(id, data) {
    this.getById(id);
    const name = (data && data.name ? String(data.name) : '').trim();
    if (!name) throw new AppError('Staff name is required', 400);
    const status = data.status === 'inactive' ? 'inactive' : 'active';
    return staffRepository.update(id, { name, status });
  }

  delete(id) {
    this.getById(id);
    if (staffRepository.countServices(id) > 0) {
      throw new AppError('Cannot delete a staff that is linked to services', 400);
    }
    return staffRepository.delete(id);
  }
}

module.exports = new StaffService();
