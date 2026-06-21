const purchaseService = require('../services/purchaseService');

class PurchaseController {
  getAll(req, res, next) {
    try {
      const { ledgerId, fromDate, toDate, search, limit } = req.query;
      const purchases = purchaseService.getAll({
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        fromDate,
        toDate,
        search,
        limit: limit ? parseInt(limit) : undefined,
      });
      res.json({ success: true, data: purchases });
    } catch (err) { next(err); }
  }

  getNextNumber(req, res, next) {
    try {
      res.json({ success: true, data: { purchase_number: purchaseService.getNextPurchaseNumber() } });
    } catch (err) { next(err); }
  }

  getById(req, res, next) {
    try {
      const purchase = purchaseService.getById(parseInt(req.params.id));
      res.json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  getByLedger(req, res, next) {
    try {
      const purchases = purchaseService.getByLedger(parseInt(req.params.ledgerId));
      res.json({ success: true, data: purchases });
    } catch (err) { next(err); }
  }

  create(req, res, next) {
    try {
      const purchase = purchaseService.create(req.body);
      res.status(201).json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  update(req, res, next) {
    try {
      const purchase = purchaseService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  delete(req, res, next) {
    try {
      purchaseService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) { next(err); }
  }
}

module.exports = new PurchaseController();
