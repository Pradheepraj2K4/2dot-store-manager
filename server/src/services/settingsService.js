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
}

module.exports = new SettingsService();
