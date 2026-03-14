/**
 * Migration v6 — Add interest_start_date to ledgers
 *
 * Allows the user to specify a custom date from which interest accrual begins,
 * rather than always defaulting to the ledger's created_at timestamp.
 */

const VERSION = 6;

function up(db) {
  db.exec(`
    ALTER TABLE ledgers ADD COLUMN interest_start_date TEXT NOT NULL DEFAULT '';
  `);
}

module.exports = { VERSION, up };
