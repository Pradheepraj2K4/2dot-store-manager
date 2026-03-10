const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DATA_DIR is injected by the Electron wrapper when running packaged,
// pointing to resources/data beside app.exe so the .db can be replaced freely.
const DB_DIR  = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'inventory.db');

let db;

/**
 * Returns the singleton better-sqlite3 database instance.
 * Creates the data directory and opens the database on first call.
 */
function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Closes the database connection (useful for clean shutdown / tests).
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb, DB_PATH };
