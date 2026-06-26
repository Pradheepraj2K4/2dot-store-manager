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

  /**
   * Bulk-overwrite the on-hand stock of items. Accepts an array of
   * `{ id, stock }`; validates each entry and applies them atomically.
   * Returns the number of items updated.
   */
  adjustStocks(adjustments) {
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      throw new AppError('No stock adjustments provided', 400);
    }
    const clean = adjustments.map((a) => {
      const id = parseInt(a && a.id, 10);
      const stock = Number(a && a.stock);
      if (!id || isNaN(id)) {
        throw new AppError('Invalid item in stock adjustment', 400);
      }
      if (a == null || a.stock === '' || a.stock == null || isNaN(stock)) {
        throw new AppError('Invalid stock value in adjustment', 400);
      }
      return { id, stock };
    });
    return itemRepository.bulkSetStock(clean);
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
