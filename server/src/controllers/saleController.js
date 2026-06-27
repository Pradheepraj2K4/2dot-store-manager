const saleService = require('../services/saleService');

class SaleController {
  getAll(req, res, next) {
    try {
      const { ledgerId, fromDate, toDate, search, limit } = req.query;
      const sales = saleService.getAll({
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        fromDate,
        toDate,
        search,
        limit: limit ? parseInt(limit) : undefined,
      });
      res.json({ success: true, data: sales });
    } catch (err) { next(err); }
  }

  getNextNumber(req, res, next) {
    try {
      res.json({ success: true, data: { sale_number: saleService.getNextSaleNumber() } });
    } catch (err) { next(err); }
  }

  getById(req, res, next) {
    try {
      const sale = saleService.getById(parseInt(req.params.id));
      res.json({ success: true, data: sale });
    } catch (err) { next(err); }
  }

  getByLedger(req, res, next) {
    try {
      const sales = saleService.getByLedger(parseInt(req.params.ledgerId));
      res.json({ success: true, data: sales });
    } catch (err) { next(err); }
  }

  getBillProfit(req, res, next) {
    try {
      const { fromDate, toDate } = req.query;
      const rows = saleService.getBillProfit({ fromDate, toDate });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  }

  create(req, res, next) {
    try {
      const sale = saleService.create(req.body);
      res.status(201).json({ success: true, data: sale });
    } catch (err) { next(err); }
  }

  update(req, res, next) {
    try {
      const sale = saleService.update(parseInt(req.params.id), req.body);
      res.json({ success: true, data: sale });
    } catch (err) { next(err); }
  }

  delete(req, res, next) {
    try {
      saleService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) { next(err); }
  }
}

module.exports = new SaleController();
