const salesReturnService = require('../services/salesReturnService');

class SalesReturnController {
  getAll(req, res, next) {
    try {
      const { ledgerId, fromDate, toDate } = req.query;
      const data = salesReturnService.getAll({
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        fromDate, toDate,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  getNextNumber(req, res, next) {
    try {
      res.json({ success: true, data: { return_number: salesReturnService.getNextNumber() } });
    } catch (err) { next(err); }
  }

  getById(req, res, next) {
    try {
      res.json({ success: true, data: salesReturnService.getById(parseInt(req.params.id)) });
    } catch (err) { next(err); }
  }

  getByLedger(req, res, next) {
    try {
      res.json({ success: true, data: salesReturnService.getByLedger(parseInt(req.params.ledgerId)) });
    } catch (err) { next(err); }
  }

  create(req, res, next) {
    try {
      const ret = salesReturnService.create(req.body);
      res.status(201).json({ success: true, data: ret });
    } catch (err) { next(err); }
  }

  update(req, res, next) {
    try {
      const ret = salesReturnService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: ret });
    } catch (err) { next(err); }
  }

  delete(req, res, next) {
    try {
      salesReturnService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) { next(err); }
  }
}

module.exports = new SalesReturnController();
