/**
 * Migration v19 — Cash sale customer details
 *
 * Adds `customer_name` and `customer_mobile` columns to the `sales` table so
 * that walk-in (CASH) sales can capture the buyer's name and mobile number
 * even though they are billed against the shared system CASH ledger.
 *
 * Both default to '' so all existing records remain unchanged.
 */

const VERSION = 19;

function up(db) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN customer_name   TEXT NOT NULL DEFAULT '';
    ALTER TABLE sales ADD COLUMN customer_mobile TEXT NOT NULL DEFAULT '';
  `);
}

module.exports = { VERSION, up };
