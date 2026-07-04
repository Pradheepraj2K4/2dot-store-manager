const waiterService = require('../services/waiterService');

class WaiterController {
  getAll(req, res, next) {
    try {
      const { search, status } = req.query;
      const waiters = waiterService.getAll({ search, status });
      res.json({ success: true, data: waiters });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const waiter = waiterService.getById(parseInt(req.params.id));
      res.json({ success: true, data: waiter });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const waiter = waiterService.create(req.body);
      res.status(201).json({ success: true, data: waiter });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const waiter = waiterService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: waiter });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      waiterService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WaiterController();
