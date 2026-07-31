/**
 * Migration v38 — Per-line sales rate on purchases (batch pricing)
 *
 * When batch tracking is enabled, a purchase line captures the MRP and the
 * sales rate for that specific batch so those prices — rather than the item
 * master's — drive the item's sale price. The sales rate is stored on the
 * purchase line (mirroring the existing `mrp` column) and propagated onto the
 * item batch.
 *
 *   • purchase_items.sales_rate — the batch's selling rate (nullable).
 */

const VERSION = 38;

function up(db) {
  db.exec(`
    ALTER TABLE purchase_items ADD COLUMN sales_rate REAL;
  `);
}

module.exports = { VERSION, up };
