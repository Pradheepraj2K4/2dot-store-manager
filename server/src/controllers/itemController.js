const itemService = require('../services/itemService');

class ItemController {
  getAll(req, res, next) {
    try {
      const items = itemService.getAll({ search: req.query.search });
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  }

  getById(req, res, next) {
    try {
      const item = itemService.getById(parseInt(req.params.id));
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  create(req, res, next) {
    try {
      const item = itemService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  update(req, res, next) {
    try {
      const item = itemService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  }

  delete(req, res, next) {
    try {
      itemService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  getBrands(req, res, next) {
    try {
      res.json({ success: true, data: itemService.getBrands() });
    } catch (err) { next(err); }
  }

  getCategories(req, res, next) {
    try {
      res.json({ success: true, data: itemService.getCategories() });
    } catch (err) { next(err); }
  }

  getStockReport(req, res, next) {
    try {
      const { search, brand, category, lowStockOnly } = req.query;
      const rows = itemService.getStockReport({
        search,
        brand,
        category,
        lowStockOnly: lowStockOnly === 'true' || lowStockOnly === '1',
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  }

  adjustStocks(req, res, next) {
    try {
      const updated = itemService.adjustStocks(req.body && req.body.adjustments);
      res.json({ success: true, data: { updated } });
    } catch (err) { next(err); }
  }

  getImeis(req, res, next) {
    try {
      const imeis = itemService.getAvailableImeis(parseInt(req.params.id));
      res.json({ success: true, data: imeis });
    } catch (err) { next(err); }
  }

  getImeiBreakdown(req, res, next) {
    try {
      const data = itemService.getImeiBreakdown(parseInt(req.params.id));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

module.exports = new ItemController();
