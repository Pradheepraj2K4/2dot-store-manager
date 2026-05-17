const itemRepository = require('../repositories/itemRepository');
const { AppError } = require('../middleware/errorHandler');

class ItemService {
  getAll(filters = {}) {
    return itemRepository.getAll(filters);
  }

  getById(id) {
    const item = itemRepository.getById(id);
    if (!item) throw new AppError('Item not found', 404);
    return item;
  }

  create(data) {
    if (!data || !data.name || !data.name.trim()) {
      throw new AppError('Item name is required', 400);
    }
    return itemRepository.create(data);
  }

  update(id, data) {
    if (!data || !data.name || !data.name.trim()) {
      throw new AppError('Item name is required', 400);
    }
    this.getById(id);
    return itemRepository.update(id, data);
  }

  delete(id) {
    this.getById(id);
    return itemRepository.delete(id);
  }

  getBrands() {
    return itemRepository.getDistinctBrands();
  }

  getCategories() {
    return itemRepository.getDistinctCategories();
  }
}

module.exports = new ItemService();
