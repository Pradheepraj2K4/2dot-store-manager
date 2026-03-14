/**
 * Migration v7 — Add ledger_date to ledgers
 *
 * A user-facing date for when the ledger account was opened (may differ from
 * the DB created_at timestamp). Interest accrual starts from this date.
 */

const VERSION = 7;

function up(db) {
  db.exec(`
    ALTER TABLE ledgers ADD COLUMN ledger_date TEXT NOT NULL DEFAULT '';
  `);
}

module.exports = { VERSION, up };
