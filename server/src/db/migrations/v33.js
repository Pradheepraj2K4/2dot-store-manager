/**
 * Migration v33 — Cash tendered
 *
 * Records the physical cash handed over by the customer at checkout so the
 * change/balance returned can be shown on the receipt:
 *
 *   • tendered_amount — cash given by the customer (>= the cash portion of the
 *     bill). The change returned is derived as tendered_amount − cash_amount.
 *
 * Defaults to 0 for existing rows (i.e. tender was not separately recorded).
 */

const VERSION = 33;

function up(db) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN tendered_amount REAL NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
