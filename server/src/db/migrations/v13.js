/**
 * Migration v13 — Add gst_percent to items master table
 */

const VERSION = 13;

function up(db) {
  db.exec(`ALTER TABLE items ADD COLUMN gst_percent REAL NOT NULL DEFAULT 0`);
}

function down() {}

module.exports = { VERSION, up, down };
