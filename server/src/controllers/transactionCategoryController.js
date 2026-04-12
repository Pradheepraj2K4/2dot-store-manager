const transactionCategoryService = require('../services/transactionCategoryService');

class TransactionCategoryController {
  getAll(req, res, next) {
    try {
      const categories = transactionCategoryService.getAll();
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const { name } = req.body;
      const category = transactionCategoryService.create(name);
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const category = transactionCategoryService.update(parseInt(req.params.id), req.body.name);
      res.json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      transactionCategoryService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TransactionCategoryController();
