/**
 * Migration v1 — Initial schema
 *
 * Establishes all base tables and indexes for the first version of the database.
 * This migration is applied once on a fresh database.
 */

const VERSION = 1;

const SQL = `
  CREATE TABLE IF NOT EXISTS parties (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT    NOT NULL CHECK(type IN ('customer', 'supplier')),
    name            TEXT    NOT NULL,
    address         TEXT    NOT NULL DEFAULT '',
    phone           TEXT    NOT NULL DEFAULT '',
    place           TEXT    NOT NULL DEFAULT '',
    opening_balance REAL    NOT NULL DEFAULT 0,
    gst_no          TEXT    NOT NULL DEFAULT '',
    state_code      TEXT    NOT NULL DEFAULT '',
    igst_status     TEXT    NOT NULL DEFAULT 'NO' CHECK(igst_status IN ('YES', 'NO')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id        INTEGER NOT NULL,
    date            TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    type            TEXT    NOT NULL CHECK(type IN ('credit', 'debit')),
    amount          REAL    NOT NULL CHECK(amount > 0),
    reference       TEXT    NOT NULL DEFAULT '',
    notes           TEXT    NOT NULL DEFAULT '',
    receipt_number  TEXT    UNIQUE,
    balance_after   REAL    NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_party ON transactions(party_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date  ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_parties_type       ON parties(type);
`;

/**
 * up(db) — runs this migration against the provided better-sqlite3 instance.
 * Wrapped in a transaction by the migration runner.
 */
function up(db) {
  db.exec(SQL);
}

module.exports = { VERSION, up };
