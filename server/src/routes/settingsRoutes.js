const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const path = require('path');
const fs = require('fs');

router.get('/', (req, res, next) => settingsController.getAll(req, res, next));
router.get('/receipt-config', (req, res, next) => settingsController.getReceiptConfig(req, res, next));
router.get('/store-profile', (req, res, next) => settingsController.getStoreProfile(req, res, next));

// Logo endpoints (MUST be before /:key to avoid being caught by the param route)
// Serve logo file
router.get('/logo-file', (req, res) => {
  const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    return res.status(404).json({ success: false, error: 'No logo found' });
  }
  const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('logo.'));
  if (files.length === 0) {
    return res.status(404).json({ success: false, error: 'No logo found' });
  }
  res.sendFile(path.join(uploadsDir, files[0]));
});

// Logo upload endpoint (base64)
router.post('/logo', (req, res, next) => {
  try {
    const { logo } = req.body; // base64 string
    if (!logo) {
      return res.status(400).json({ success: false, error: 'No logo data provided' });
    }
    const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // Extract image data
    const matches = logo.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, error: 'Invalid image format' });
    }
    const ext = matches[1] === 'svg+xml' ? 'svg' : matches[1];
    const data = matches[2];
    const filename = `logo.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Remove old logo files
    const existingFiles = fs.readdirSync(uploadsDir).filter(f => f.startsWith('logo.'));
    existingFiles.forEach(f => fs.unlinkSync(path.join(uploadsDir, f)));

    fs.writeFileSync(filePath, data, 'base64');
    
    // Save logo path in settings
    const settingsService = require('../services/settingsService');
    settingsService.updateSetting('logo_path', `/api/settings/logo-file`);

    res.json({ success: true, data: { path: `/api/settings/logo-file` } });
  } catch (err) {
    next(err);
  }
});

// Delete logo
router.delete('/logo', (req, res) => {
  const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('logo.'));
    files.forEach(f => fs.unlinkSync(path.join(uploadsDir, f)));
  }
  const settingsService = require('../services/settingsService');
  settingsService.updateSetting('logo_path', '');
  res.json({ success: true });
});

// ── Backup routes (MUST be before the generic /:key routes) ─────────────────

// GET /settings/backup/status — returns backup settings + whether today's backup exists
router.get('/backup/status', (req, res, next) => {
  try {
    const settingsService = require('../services/settingsService');
    const allSettings = settingsService.getAllSettings();
    const backupDir  = allSettings.backup_dir || '';
    const enabled    = allSettings.backup_enabled === true || allSettings.backup_enabled === 'true';

    let todayBackupExists = false;
    if (backupDir && fs.existsSync(backupDir)) {
      const now  = new Date();
      const dd   = String(now.getDate()).padStart(2, '0');
      const mm   = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const dateStr  = `${dd}-${mm}-${yyyy}`;
      todayBackupExists = fs.existsSync(path.join(backupDir, `inventory_${dateStr}.db`));
    }

    res.json({ success: true, data: { enabled, dir: backupDir, todayBackupExists } });
  } catch (err) {
    next(err);
  }
});

// POST /settings/backup/now — trigger an immediate backup
router.post('/backup/now', (req, res, next) => {
  try {
    const { triggerBackupNow } = require('../utils/backupService');
    const result = triggerBackupNow();
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    next(err);
  }
});

// POST /settings/data/clear — delete all non-settings data (ledgers, transactions, interest, expenses)
router.post('/data/clear', (req, res, next) => settingsController.clearData(req, res, next));

// POST /settings/reset — reset all settings to their seeded defaults
router.post('/reset', (req, res, next) => settingsController.resetSettings(req, res, next));

// Dynamic key routes (MUST be after all specific routes)
router.get('/:key', (req, res, next) => settingsController.get(req, res, next));
router.put('/batch', (req, res, next) => settingsController.updateMultiple(req, res, next));
router.put('/:key', (req, res, next) => settingsController.update(req, res, next));

module.exports = router;
