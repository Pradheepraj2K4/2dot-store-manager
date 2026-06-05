/**
 * Migration v22 — Expense voucher numbers
 *
 * Adds a `voucher_number` column to the `expenses` table so that a single
 * expense entry can contain multiple line rows that all share the same
 * voucher number (mirroring how items in a sale share a sale number).
 *
 * Defaults to '' so all existing records remain unchanged.
 */

const VERSION = 22;

function up(db) {
  db.exec(`
    ALTER TABLE expenses ADD COLUMN voucher_number TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_expenses_voucher_number ON expenses (voucher_number);
  `);
}

module.exports = { VERSION, up };
