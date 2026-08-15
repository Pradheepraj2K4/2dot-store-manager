const unitService = require('../services/unitService');

class UnitController {
  getAll(req, res, next) {
    try {
      const { search } = req.query;
      const units = unitService.getAll({ search });
      res.json({ success: true, data: units });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const unit = unitService.getById(parseInt(req.params.id));
      res.json({ success: true, data: unit });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const unit = unitService.create(req.body);
      res.status(201).json({ success: true, data: unit });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const unit = unitService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: unit });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      unitService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UnitController();
