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
      gst_tax_id: settingsRepository.get('gst_tax_id'),
      phone: settingsRepository.get('phone'),
      email: settingsRepository.get('email'),
      logo_path: settingsRepository.get('logo_path'),
    };
  }

  clearData() {
    const { getDb } = require('../db/database');
    const db = getDb();
    const tables = ['interest_entries', 'transactions', 'expenses', 'ledgers', 'ledger_types', 'schema_version'];
    db.transaction(() => {
      for (const table of tables) {
        try { db.prepare(`DELETE FROM ${table}`).run(); } catch (_) { /* table may not exist */ }
      }
      // Reset any auto-increment sequences
      try { db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('interest_entries','transactions','expenses','ledgers','ledger_types')`).run(); } catch (_) { /* sqlite_sequence may not exist */ }
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
