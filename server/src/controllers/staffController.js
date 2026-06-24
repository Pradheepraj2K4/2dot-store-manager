const staffService = require('../services/staffService');

class StaffController {
  getAll(req, res, next) {
    try {
      const { search, status } = req.query;
      const staffs = staffService.getAll({ search, status });
      res.json({ success: true, data: staffs });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const staff = staffService.getById(parseInt(req.params.id));
      res.json({ success: true, data: staff });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const staff = staffService.create(req.body);
      res.status(201).json({ success: true, data: staff });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const staff = staffService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: staff });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      staffService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
