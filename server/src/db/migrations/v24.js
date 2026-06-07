/**
 * Migration v24 — Item IMEI / serial tracking
 *
 * Adds an `item_imeis` table that tracks individual IMEI (or serial) numbers
 * for items when the IMEI module is enabled. Each row represents one physical
 * unit that was brought in via a purchase and may later be consumed by a sale.
 *
 *   status = 'in_stock' → available to be sold
 *   status = 'sold'     → consumed by a sale (linked via sale_id)
 *
 * IMEIs are linked back to the originating purchase and the consuming sale so
 * that edits / deletes of those documents can restore or remove them. A unique
 * index on (item_id, imei) prevents the same IMEI being registered twice for
 * the same item.
 */

const VERSION = 24;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_imeis (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER NOT NULL,
      imei        TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'in_stock',
      purchase_id INTEGER,
      sale_id     INTEGER,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_item_imeis_unique ON item_imeis (item_id, imei);
    CREATE INDEX IF NOT EXISTS idx_item_imeis_item_status ON item_imeis (item_id, status);
    CREATE INDEX IF NOT EXISTS idx_item_imeis_purchase ON item_imeis (purchase_id);
    CREATE INDEX IF NOT EXISTS idx_item_imeis_sale ON item_imeis (sale_id);
  `);
}

module.exports = { VERSION, up };
