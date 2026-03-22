/**
 * Migration v9 — Interest Schemes table
 *
 * Introduces a configurable `interest_schemes` table so the user can define
 * custom scheme names (e.g. "Gold Loan", "Flat Rate") where each scheme has a
 * calculation nature of either DAILY or MONTHLY.
 *
 * Also adds `interest_scheme_id` (nullable FK) to `ledgers` and back-fills it
 * from the existing `interest_scheme` text column for any ledger that already
 * has DAILY or MONTHLY set.
 */

const VERSION = 9;

function up(db) {
  // 1. Create the interest_schemes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS interest_schemes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      nature     TEXT    NOT NULL DEFAULT 'MONTHLY' CHECK(nature IN ('DAILY', 'MONTHLY')),
      is_system  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Seed the two built-in schemes
    INSERT OR IGNORE INTO interest_schemes (name, nature, is_system) VALUES ('Daily',   'DAILY',   1);
    INSERT OR IGNORE INTO interest_schemes (name, nature, is_system) VALUES ('Monthly', 'MONTHLY', 1);
  `);

  // 2. Add interest_scheme_id to ledgers (nullable FK)
  try {
    db.exec(`ALTER TABLE ledgers ADD COLUMN interest_scheme_id INTEGER REFERENCES interest_schemes(id);`);
  } catch (_) {
    // Column already exists — safe to ignore (e.g. if migration is re-run)
  }

  // 3. Back-fill interest_scheme_id from the existing text column
  db.exec(`
    UPDATE ledgers
    SET interest_scheme_id = (
      SELECT id FROM interest_schemes WHERE nature = ledgers.interest_scheme
    )
    WHERE interest_scheme IN ('DAILY', 'MONTHLY') AND interest_scheme_id IS NULL;
  `);
}

function down() {}

module.exports = { VERSION, up, down };
