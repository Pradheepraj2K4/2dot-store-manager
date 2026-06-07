const itemRepository = require('../repositories/itemRepository');
const imeiRepository = require('../repositories/imeiRepository');
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

  getStockReport(filters = {}) {
    return itemRepository.getStockReport(filters);
  }

  getAvailableImeis(id) {
    this.getById(id);
    return imeiRepository.getAvailableByItem(id);
  }

  /** Breakdown of an item's IMEIs into purchased (all), sold and remaining. */
  getImeiBreakdown(id) {
    const rows = imeiRepository.getAllByItem(id);
    return {
      purchased: rows.map((r) => r.imei),
      sold: rows.filter((r) => r.status === 'sold').map((r) => r.imei),
      remaining: rows.filter((r) => r.status === 'in_stock').map((r) => r.imei),
    };
  }
}

module.exports = new ItemService();
