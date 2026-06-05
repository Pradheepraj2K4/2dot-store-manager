const expenseService = require('../services/expenseService');

class ExpenseController {
  // ── Categories ────────────────────────────────────────────────────────

  getCategories(req, res, next) {
    try {
      const categories = expenseService.getAllCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  createCategory(req, res, next) {
    try {
      const { name } = req.body;
      const category = expenseService.createCategory(name);
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  updateCategory(req, res, next) {
    try {
      const category = expenseService.updateCategory(parseInt(req.params.id), req.body.name);
      res.json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  deleteCategory(req, res, next) {
    try {
      expenseService.deleteCategory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ── Expenses ──────────────────────────────────────────────────────────

  getAll(req, res, next) {
    try {
      const { fromDate, toDate, categoryId, expenseName } = req.query;
      const expenses = expenseService.getAll({ fromDate, toDate, categoryId, expenseName });
      res.json({ success: true, data: expenses });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const expense = expenseService.getById(parseInt(req.params.id));
      res.json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const expense = expenseService.create(req.body);
      res.status(201).json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  getNextVoucher(req, res, next) {
    try {
      res.json({ success: true, data: { voucher_number: expenseService.getNextVoucherNumber() } });
    } catch (err) {
      next(err);
    }
  }

  createBatch(req, res, next) {
    try {
      const result = expenseService.createBatch(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const expense = expenseService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      expenseService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  getSuggestions(req, res, next) {
    try {
      const suggestions = expenseService.getSuggestions(req.query.q || '');
      res.json({ success: true, data: suggestions });
    } catch (err) {
      next(err);
    }
  }

  getSummary(req, res, next) {
    try {
      const { fromDate, toDate } = req.query;
      const summary = expenseService.getSummary({ fromDate, toDate });
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ExpenseController();
