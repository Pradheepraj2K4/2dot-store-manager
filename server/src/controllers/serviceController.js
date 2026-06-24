const serviceService = require('../services/serviceService');

class ServiceController {
  getAll(req, res, next) {
    try {
      const { status, ledgerId, fromDate, toDate } = req.query;
      const services = serviceService.getAll({
        status,
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        fromDate,
        toDate,
      });
      res.json({ success: true, data: services });
    } catch (err) {
      next(err);
    }
  }

  getNextNumber(req, res, next) {
    try {
      const service_number = serviceService.getNextServiceNumber();
      res.json({ success: true, data: { service_number } });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const service = serviceService.getById(parseInt(req.params.id));
      res.json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const service = serviceService.create(req.body);
      res.status(201).json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const service = serviceService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }

  close(req, res, next) {
    try {
      const service = serviceService.close(parseInt(req.params.id), req.body);
      res.json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      serviceService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ServiceController();
