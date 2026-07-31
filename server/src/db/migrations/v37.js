/**
 * Migration v37 — Item batches (purchase batch tracking)
 *
 * Introduces optional per-batch inventory. When the developer setting
 * `purchase_batch_enabled` is on, each purchase line records a batch number
 * and the stock/price for that batch is tracked independently in the new
 * `item_batches` table. The same item can therefore carry different prices
 * across batches. Sales draw stock from a chosen batch.
 *
 *   • item_batches            — one row per (item, batch_no) with its own stock.
 *   • purchase_items.batch_no — the batch a purchase line stocked into.
 *   • purchase_items.batch_id — FK to item_batches.
 *   • sale_items.batch_no     — the batch a sale line drew from.
 *   • sale_items.batch_id     — FK to item_batches.
 */

const VERSION = 37;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_batches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id       INTEGER NOT NULL,
      batch_no      TEXT    NOT NULL,
      mrp           REAL    NOT NULL DEFAULT 0,
      rate          REAL    NOT NULL DEFAULT 0,
      sales_rate    REAL,
      gst_percent   REAL    NOT NULL DEFAULT 0,
      current_stock REAL    NOT NULL DEFAULT 0,
      purchase_id   INTEGER,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (item_id)     REFERENCES items(id),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      UNIQUE(item_id, batch_no)
    );

    ALTER TABLE purchase_items ADD COLUMN batch_no TEXT NOT NULL DEFAULT '';
    ALTER TABLE purchase_items ADD COLUMN batch_id INTEGER;
    ALTER TABLE sale_items     ADD COLUMN batch_no TEXT NOT NULL DEFAULT '';
    ALTER TABLE sale_items     ADD COLUMN batch_id INTEGER;
  `);
}

module.exports = { VERSION, up };
