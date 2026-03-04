const interestService = require('../services/interestService');

class InterestController {
  /**
   * GET /api/interest
   * Get all interest entries. Query params: partyId, status, startDate, endDate
   */
  getAll(req, res, next) {
    try {
      const { partyId, status, startDate, endDate } = req.query;
      const entries = interestService.getEntries({ partyId, status, startDate, endDate });
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/interest/summary
   * Get interest summary grouped by party.
   */
  getSummary(req, res, next) {
    try {
      const summary = interestService.getSummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/interest/party/:partyId
   * Get interest entries for a specific party (auto-generates up to today).
   */
  getByParty(req, res, next) {
    try {
      const entries = interestService.getEntriesByParty(parseInt(req.params.partyId));
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/interest/generate
   * Generate interest entries for all parties (or a specific party).
   * Body: { partyId? , upToDate? }
   */
  generate(req, res, next) {
    try {
      const { partyId, upToDate } = req.body;
      let result;
      if (partyId) {
        const entries = interestService.generateEntries(parseInt(partyId), upToDate || null);
        result = { generated: entries.length, entries };
      } else {
        result = interestService.generateAllEntries(upToDate || null);
      }
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/interest/:id/adjust
   * Adjust an interest entry. Body: { adjustment, notes? }
   */
  adjust(req, res, next) {
    try {
      const entry = interestService.adjustEntry(parseInt(req.params.id), req.body);
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/interest/:id/waive
   * Waive an interest entry entirely. Body: { notes? }
   */
  waive(req, res, next) {
    try {
      const entry = interestService.waiveEntry(parseInt(req.params.id), req.body.notes);
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/interest/party/:partyId/total
   * Get total pending interest for a party.
   */
  getTotalPending(req, res, next) {
    try {
      const total = interestService.getTotalPendingInterest(parseInt(req.params.partyId));
      res.json({ success: true, data: { total_pending_interest: total } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/interest/enabled
   * Check whether the interest module is enabled.
   */
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
