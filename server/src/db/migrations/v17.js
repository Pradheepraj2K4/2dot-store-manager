/**
 * Migration v17 — Bill Discount
 *
 * Adds a `bill_discount` column to the `sales` and `purchases` tables to
 * store a flat amount discount applied at the bill level (separate from the
 * per-line item discounts that are already tracked via `total_discount`).
 *
 * Defaults to 0 so all existing records remain unchanged.
 */

const VERSION = 17;

function up(db) {
  db.exec(`
    ALTER TABLE sales     ADD COLUMN bill_discount REAL NOT NULL DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN bill_discount REAL NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
