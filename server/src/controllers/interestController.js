const interestService = require('../services/interestService');

class InterestController {
  getAll(req, res, next) {
    try {
      const { ledgerId, status, fromDate, toDate } = req.query;
      const entries = interestService.getEntries({
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        status: status || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  }

  getByLedger(req, res, next) {
    try {
      const entries = interestService.getEntriesByLedger(parseInt(req.params.ledgerId));
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  }

  getPendingByLedger(req, res, next) {
    try {
      const entries = interestService.getPendingByLedger(parseInt(req.params.ledgerId));
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  }

  getTotalPending(req, res, next) {
    try {
      const total = interestService.getTotalPendingByLedger(parseInt(req.params.ledgerId));
      res.json({ success: true, data: { total_pending_interest: total } });
    } catch (err) {
      next(err);
    }
  }

  generate(req, res, next) {
    try {
      const { ledgerId, upToDate } = req.body;
      let result;
      if (ledgerId) {
        const entries = interestService.generateForLedger(parseInt(ledgerId), upToDate || null);
        result = { generated: entries.length, entries };
      } else {
        result = interestService.generateAll(upToDate || null);
      }
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  markPaid(req, res, next) {
    try {
      const entry = interestService.markPaid(
        parseInt(req.params.id),
        req.body.paidDate || null,
        req.body.amount != null ? req.body.amount : null
      );
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  deleteEntry(req, res, next) {
    try {
      interestService.deleteEntry(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  isEnabled(req, res, next) {
    try {
      const enabled = interestService.isModuleEnabled();
      res.json({ success: true, data: { enabled } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InterestController();
