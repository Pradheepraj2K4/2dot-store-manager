const ledgerService = require('../services/ledgerService');

class LedgerController {
  getAll(req, res, next) {
    try {
      const { ledgerTypeId, status, behaviour, search } = req.query;
      let ledgers;
      if (search) {
        ledgers = ledgerService.searchLedgers(search);
      } else {
        ledgers = ledgerService.getAllLedgers({
          ledgerTypeId: ledgerTypeId ? parseInt(ledgerTypeId) : undefined,
          status: status || undefined,
          behaviour: behaviour || undefined,
        });
      }
      res.json({ success: true, data: ledgers });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const ledger = ledgerService.getLedgerById(parseInt(req.params.id));
      res.json({ success: true, data: ledger });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const ledger = ledgerService.createLedger(req.body);
      res.status(201).json({ success: true, data: ledger });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const ledger = ledgerService.updateLedger(parseInt(req.params.id), req.body);
      res.json({ success: true, data: ledger });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      const result = ledgerService.deleteLedger(parseInt(req.params.id));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  bulkCreate(req, res, next) {
    try {
      const { ledgers } = req.body;
      if (!Array.isArray(ledgers) || ledgers.length === 0) {
        return res.status(400).json({ success: false, message: 'ledgers array is required' });
      }
      if (ledgers.length > 500) {
        return res.status(400).json({ success: false, message: 'Cannot import more than 500 ledgers at once' });
      }
      const results = ledgerService.bulkCreateLedgers(ledgers);
      res.status(201).json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }

  getCounts(req, res, next) {
    try {
      const counts = ledgerService.getLedgerCounts();
      res.json({ success: true, data: counts });
    } catch (err) {
      next(err);
    }
  }

  getOutstanding(req, res, next) {
    try {
      const ledgers = ledgerService.getAllWithOutstanding();
      res.json({ success: true, data: ledgers });
    } catch (err) {
      next(err);
    }
  }

  getOutstandingByType(req, res, next) {
    try {
      const ledgers = ledgerService.getOutstandingByType(parseInt(req.params.typeId));
      res.json({ success: true, data: ledgers });
    } catch (err) {
      next(err);
    }
  }

  getPendingInterest(req, res, next) {
    try {
      const ledgers = ledgerService.getLedgersWithPendingInterest();
      res.json({ success: true, data: ledgers });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LedgerController();
