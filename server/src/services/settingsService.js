const settingsRepository = require('../repositories/settingsRepository');

class SettingsService {
  getAllSettings() {
    return settingsRepository.getAll();
  }

  getSetting(key) {
    return settingsRepository.get(key);
  }

  updateSetting(key, value) {
    return settingsRepository.set(key, value);
  }

  updateMultipleSettings(entries) {
    return settingsRepository.setMultiple(entries);
  }

  getReceiptConfig() {
    return settingsRepository.get('receipt_config');
  }

  getStoreProfile() {
    return {
      store_name: settingsRepository.get('store_name'),
      address: settingsRepository.get('address'),
      place: settingsRepository.get('place'),
      gst_tax_id: settingsRepository.get('gst_tax_id'),
      phone: settingsRepository.get('phone'),
      email: settingsRepository.get('email'),
      // UPI id used to render a payment QR code on the thermal bill.
      upi_id: settingsRepository.get('upi_id'),
      // Derive the logo path from the actual file on disk so a stale/empty
      // `logo_path` setting never hides an uploaded logo.
      logo_path: this.resolveLogoPath(),
      // Thermal receipt logo height (mm) — configured via receipt_config so
      // every receipt builder that receives the store profile honours it.
      thermal_logo_height: this.resolveThermalLogoHeight(),
      // Thermal UPI QR size (mm) — configured via receipt_config.
      thermal_upi_qr_size: this.resolveThermalUpiQrSize(),
      // Thermal paper/roll width (mm) — configured via receipt_config.
      thermal_width: this.resolveThermalWidth(),
    };
  }

  // Reads the thermal logo height (mm) from receipt_config, clamped to a sane
  // 6–40mm range. Falls back to 12mm when unset or invalid.
  resolveThermalLogoHeight() {
    const cfg = settingsRepository.get('receipt_config');
    const raw = cfg && typeof cfg === 'object' ? Number(cfg.thermalLogoHeight) : NaN;
    if (!Number.isFinite(raw) || raw <= 0) return 12;
    return Math.min(40, Math.max(6, raw));
  }

  // Reads the thermal UPI QR size (mm) from receipt_config, clamped to a sane
  // 15–50mm range. Falls back to 28mm when unset or invalid.
  resolveThermalUpiQrSize() {
    const cfg = settingsRepository.get('receipt_config');
    const raw = cfg && typeof cfg === 'object' ? Number(cfg.thermalUpiQrSize) : NaN;
    if (!Number.isFinite(raw) || raw <= 0) return 28;
    return Math.min(50, Math.max(15, raw));
  }

  // Reads the thermal paper/roll width (mm) from receipt_config, clamped to a
  // sane 50–80mm range. Falls back to 80mm when unset or invalid.
  resolveThermalWidth() {
    const cfg = settingsRepository.get('receipt_config');
    const raw = cfg && typeof cfg === 'object' ? Number(cfg.thermalWidth) : NaN;
    if (!Number.isFinite(raw) || raw <= 0) return 80;
    return Math.min(80, Math.max(50, raw));
  }

  // Returns the public logo URL when a logo file exists on disk, else ''.
  resolveLogoPath() {
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
    try {
      if (fs.existsSync(uploadsDir)) {
        const hasLogo = fs.readdirSync(uploadsDir).some((f) => f.startsWith('logo.'));
        if (hasLogo) return '/api/settings/logo-file';
      }
    } catch (_) { /* fall through to stored setting */ }
    return settingsRepository.get('logo_path') || '';
  }

  clearData() {
    const { getDb } = require('../db/database');
    const db = getDb();
    const tables = ['interest_entries', 'transactions', 'expenses', 'ledgers', 'transaction_categories'];
    db.transaction(() => {
      for (const table of tables) {
        try { db.prepare(`DELETE FROM ${table}`).run(); } catch (_) { /* table may not exist */ }
      }
      // Remove only non-system ledger types; keep Customer & Supplier
      try { db.prepare(`DELETE FROM ledger_types WHERE is_system = 0`).run(); } catch (_) {}
      // Remove only non-system interest schemes; keep Daily & Monthly
      try { db.prepare(`DELETE FROM interest_schemes WHERE is_system = 0`).run(); } catch (_) {}
      // Reset any auto-increment sequences
      try { db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('interest_entries','transactions','expenses','ledgers')`).run(); } catch (_) { /* sqlite_sequence may not exist */ }
    })();
  }

  /**
   * Clear transactional data while preserving master records.
   *
   * KEPT (masters): ledgers, items, ledger_types, interest_schemes,
   *   transaction_categories, expense_categories, staffs, settings, users.
   * CLEARED (transactional): sales, purchases, returns, estimations,
   *   services, interest entries, transactions, expenses and item IMEIs.
   *
   * Ledger balances are reset back to their opening balance so the
   * surviving masters stay internally consistent.
   */
  clearTransactions() {
    const { getDb } = require('../db/database');
    const db = getDb();
    // Order matters: child/line tables before their parents.
    const tables = [
      'item_imeis',
      'sale_items', 'sales',
      'purchase_items', 'purchases',
      'sales_return_items', 'sales_returns',
      'purchase_return_items', 'purchase_returns',
      'estimation_items', 'estimations',
      'services',
      'interest_entries',
      'transactions',
      'expenses',
    ];
    db.transaction(() => {
      for (const table of tables) {
        try { db.prepare(`DELETE FROM ${table}`).run(); } catch (_) { /* table may not exist */ }
      }
      // Surviving ledgers go back to their opening balance.
      try { db.prepare(`UPDATE ledgers SET current_balance = opening_balance`).run(); } catch (_) {}
      // Reset auto-increment sequences for the cleared tables.
      try {
        const names = tables.map((t) => `'${t}'`).join(',');
        db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${names})`).run();
      } catch (_) { /* sqlite_sequence may not exist */ }
    })();
  }

  resetSettings() {
    const { getDb } = require('../db/database');
    const { seedSettings } = require('../db/seeds/settings');
    const db = getDb();
    db.prepare('DELETE FROM settings').run();
    seedSettings(db);
  }
}

module.exports = new SettingsService();
