/**
 * Migration v25 — Per-item IMEI tracking flag
 *
 * Adds an `imei_enabled` flag to the `items` table. When set to 1, the item
 * requires an IMEI / serial number per unit during Purchase Entry (and the
 * matching IMEIs are picked during Sales Entry). Items left at 0 behave as
 * before and never prompt for IMEIs.
 */

const VERSION = 25;

function up(db) {
  db.exec(`
    ALTER TABLE items ADD COLUMN imei_enabled INTEGER NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
