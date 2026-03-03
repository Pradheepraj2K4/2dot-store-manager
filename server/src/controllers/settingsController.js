const settingsService = require('../services/settingsService');

class SettingsController {
  getAll(req, res, next) {
    try {
      const settings = settingsService.getAllSettings();
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  get(req, res, next) {
    try {
      const value = settingsService.getSetting(req.params.key);
      res.json({ success: true, data: { key: req.params.key, value } });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const result = settingsService.updateSetting(req.params.key, req.body.value);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  updateMultiple(req, res, next) {
    try {
      const settings = settingsService.updateMultipleSettings(req.body);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  getReceiptConfig(req, res, next) {
    try {
      const config = settingsService.getReceiptConfig();
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }

  getStoreProfile(req, res, next) {
    try {
      const profile = settingsService.getStoreProfile();
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SettingsController();
