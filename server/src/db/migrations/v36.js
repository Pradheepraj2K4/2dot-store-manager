/**
 * Migration v36 — Purchase order number
 *
 * Adds an optional purchase-order (PO) reference to a purchase, captured
 * alongside the supplier's invoice/bill number:
 *
 *   • purchases.po_number — the buyer's purchase-order reference.
 *
 * Defaults to an empty string for existing rows.
 */

const VERSION = 36;

function up(db) {
  db.exec(`
    ALTER TABLE purchases ADD COLUMN po_number TEXT NOT NULL DEFAULT '';
  `);
}

module.exports = { VERSION, up };
