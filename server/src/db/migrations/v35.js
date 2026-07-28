/**
 * Migration v35 — Freight charge
 *
 * Adds an optional freight/shipping charge that is added on top of the bill
 * total on both sales and purchases:
 *
 *   • sales.freight_charge     — freight added to a sale's payable total.
 *   • purchases.freight_charge — freight added to a purchase's payable total.
 *
 * The field is surfaced in the UI only when the `freight_charge_enabled`
 * developer setting is on. Defaults to 0 for existing rows.
 */

const VERSION = 35;

function up(db) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN freight_charge REAL NOT NULL DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN freight_charge REAL NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
