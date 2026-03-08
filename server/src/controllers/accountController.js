// LedgerTypeController — manages custom ledger types (formerly AccountController)
const ledgerTypeService = require('../services/accountService');

class LedgerTypeController {
  getAll(req, res, next) {
    try {
      const types = ledgerTypeService.getAllTypes();
      res.json({ success: true, data: types });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const type = ledgerTypeService.getTypeById(parseInt(req.params.id));
      res.json({ success: true, data: type });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const type = ledgerTypeService.createType(req.body);
      res.status(201).json({ success: true, data: type });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const type = ledgerTypeService.updateType(parseInt(req.params.id), req.body);
      res.json({ success: true, data: type });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      const result = ledgerTypeService.deleteType(parseInt(req.params.id));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LedgerTypeController();
