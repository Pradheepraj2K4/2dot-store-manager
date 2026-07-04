/**
 * Migration v29 — Split payment (Cash / UPI) on sales
 *
 * Adds two columns to the `sales` table so a bill can record how the payment
 * was tendered, split between cash and UPI:
 *
 *   • cash_amount — amount received in cash.
 *   • upi_amount  — amount received via UPI.
 *
 * Both default to 0 so every existing sale remains valid; the two together are
 * expected to equal the bill's net total.
 */

const VERSION = 29;

function up(db) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0;
    ALTER TABLE sales ADD COLUMN upi_amount  REAL NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
