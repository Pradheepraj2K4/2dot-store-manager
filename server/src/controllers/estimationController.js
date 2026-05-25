const estimationService = require('../services/estimationService');

class EstimationController {
  getAll(req, res, next) {
    try {
      const { ledgerId, fromDate, toDate, status } = req.query;
      const data = estimationService.getAll({
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        fromDate, toDate, status,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  getNextNumber(req, res, next) {
    try {
      res.json({ success: true, data: { estimation_number: estimationService.getNextNumber() } });
    } catch (err) { next(err); }
  }

  getById(req, res, next) {
    try {
      res.json({ success: true, data: estimationService.getById(parseInt(req.params.id)) });
    } catch (err) { next(err); }
  }

  create(req, res, next) {
    try {
      const est = estimationService.create(req.body);
      res.status(201).json({ success: true, data: est });
    } catch (err) { next(err); }
  }

  update(req, res, next) {
    try {
      const est = estimationService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: est });
    } catch (err) { next(err); }
  }

  delete(req, res, next) {
    try {
      estimationService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  convert(req, res, next) {
    try {
      const sale = estimationService.convertToSale(parseInt(req.params.id));
      res.json({ success: true, data: sale });
    } catch (err) { next(err); }
  }
}

module.exports = new EstimationController();
