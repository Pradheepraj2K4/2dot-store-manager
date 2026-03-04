/**
 * Migration v2 — Interest module
 *
 * Adds interest fields to parties and creates the interest_entries table
 * for tracking daily/monthly interest accruals and adjustments.
 */

const VERSION = 2;

const SQL = `
  -- Add interest columns to parties
  ALTER TABLE parties ADD COLUMN interest_rate    REAL NOT NULL DEFAULT 0;
  ALTER TABLE parties ADD COLUMN interest_scheme  TEXT NOT NULL DEFAULT 'NONE' CHECK(interest_scheme IN ('NONE', 'DAILY', 'MONTHLY'));

  -- Interest entries table
  CREATE TABLE IF NOT EXISTS interest_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id        INTEGER NOT NULL,
    date            TEXT    NOT NULL,
    principal       REAL    NOT NULL DEFAULT 0,
    rate            REAL    NOT NULL DEFAULT 0,
    scheme          TEXT    NOT NULL CHECK(scheme IN ('DAILY', 'MONTHLY')),
    interest_amount REAL    NOT NULL DEFAULT 0,
    adjustment      REAL    NOT NULL DEFAULT 0,
    notes           TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'adjusted', 'waived')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_interest_entries_party  ON interest_entries(party_id);
  CREATE INDEX IF NOT EXISTS idx_interest_entries_date   ON interest_entries(date);
  CREATE INDEX IF NOT EXISTS idx_interest_entries_status ON interest_entries(status);
`;

function up(db) {
  db.exec(SQL);
}

module.exports = { VERSION, up };
