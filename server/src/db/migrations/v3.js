/**
 * Migration v3 — Payment target support
 *
 * Adds a `payment_target` column to transactions so payments can be
 * directed at either the principal balance or pending interest.
 *
 * Values: 'principal' (default) | 'interest'
 */

const VERSION = 3;

const SQL = `
  ALTER TABLE transactions ADD COLUMN payment_target TEXT NOT NULL DEFAULT 'principal'
    CHECK(payment_target IN ('principal', 'interest'));
`;

function up(db) {
  db.exec(SQL);
}

module.exports = { VERSION, up };
