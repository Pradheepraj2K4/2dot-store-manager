const { getDb } = require('../db/database');

class SettingsRepository {
  getAll() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM settings ORDER BY key ASC').all();
    const settings = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    return settings;
  }

  get(key) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  set(key, value) {
    const db = getDb();
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, strValue);
    return { key, value };
  }

  setMultiple(entries) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    const updateAll = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        stmt.run(key, strValue);
      }
    });
    updateAll(entries);
    return this.getAll();
  }

  delete(key) {
    const db = getDb();
    return db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

module.exports = new SettingsRepository();
