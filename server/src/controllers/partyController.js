const partyService = require('../services/partyService');

class PartyController {
  getAll(req, res, next) {
    try {
      const { type, search } = req.query;
      let parties;
      if (search) {
        parties = partyService.searchParties(search);
      } else {
        parties = partyService.getAllParties(type || null);
      }
      res.json({ success: true, data: parties });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const party = partyService.getPartyById(parseInt(req.params.id));
      res.json({ success: true, data: party });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const party = partyService.createParty(req.body);
      res.status(201).json({ success: true, data: party });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const party = partyService.updateParty(parseInt(req.params.id), req.body);
      res.json({ success: true, data: party });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      const result = partyService.deleteParty(parseInt(req.params.id));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  getCounts(req, res, next) {
    try {
      const counts = partyService.getPartyCounts();
      res.json({ success: true, data: counts });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PartyController();
