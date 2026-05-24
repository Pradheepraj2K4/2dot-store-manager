/**
 * Migration v15 — Item code (SKU/barcode) on items master
 *
 * Adds an optional, user-defined short code that can be used to search
 * for items quickly from sales / purchase entry screens. Not unique by
 * design — duplicates are allowed (some shops reuse codes across
 * variants); enforce uniqueness at the UI level if desired later.
 */

const VERSION = 15;

const SQL = `
  ALTER TABLE items ADD COLUMN item_code TEXT NOT NULL DEFAULT '';
  CREATE INDEX IF NOT EXISTS idx_items_item_code ON items(item_code);
`;

function up(db) {
  db.exec(SQL);
}

function down() {}

module.exports = { VERSION, up, down };
