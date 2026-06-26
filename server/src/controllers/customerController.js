const customerService = require('../services/customerService');

class CustomerController {
  getAll(req, res, next) {
    try {
      const { search, status } = req.query;
      const customers = customerService.getAll({ search, status });
      res.json({ success: true, data: customers });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const customer = customerService.getById(parseInt(req.params.id));
      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const customer = customerService.create(req.body);
      res.status(201).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const customer = customerService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      customerService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();
