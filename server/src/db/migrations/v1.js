/**
 * Migration v1 — Complete schema (redesigned)
 *
 * Tables: ledger_types, ledgers, interest_entries, transactions, settings
 *
 * - ledger_types: configurable types (customer, supplier, custom) with behaviour
 * - ledgers: 1:1 accounts with balance, interest config, contact info
 * - interest_entries: accrued interest per period (pending/paid)
 * - transactions: payments (PAY-NNNNN) and receipts (REC-NNNNN) against ledgers
 * - settings: key-value application settings
 */

const VERSION = 1;

const SQL = `
  -- ── Ledger Types ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS ledger_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    behaviour   TEXT    NOT NULL CHECK(behaviour IN ('customer', 'supplier')),
    is_system   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- Seed the two built-in types
  INSERT INTO ledger_types (name, behaviour, is_system) VALUES ('Customer', 'customer', 1);
  INSERT INTO ledger_types (name, behaviour, is_system) VALUES ('Supplier', 'supplier', 1);

  -- ── Ledgers (1:1 with account) ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS ledgers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_type_id  INTEGER NOT NULL,
    name            TEXT    NOT NULL,
    address         TEXT    NOT NULL DEFAULT '',
    phone           TEXT    NOT NULL DEFAULT '',
    place           TEXT    NOT NULL DEFAULT '',
    gst_no          TEXT    NOT NULL DEFAULT '',
    state_code      TEXT    NOT NULL DEFAULT '',
    igst_status     TEXT    NOT NULL DEFAULT 'NO' CHECK(igst_status IN ('YES', 'NO')),
    opening_balance REAL    NOT NULL DEFAULT 0,
    current_balance REAL    NOT NULL DEFAULT 0,
    interest_rate   REAL    NOT NULL DEFAULT 0,
    interest_scheme TEXT    NOT NULL DEFAULT 'NONE'
                    CHECK(interest_scheme IN ('NONE', 'DAILY', 'MONTHLY')),
    status          TEXT    NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active', 'closed')),
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_type_id) REFERENCES ledger_types(id)
  );

  -- ── Interest Entries ────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS interest_entries (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id         INTEGER NOT NULL,
    amount            REAL    NOT NULL DEFAULT 0,
    from_date         TEXT    NOT NULL,
    to_date           TEXT    NOT NULL,
    days              INTEGER NOT NULL DEFAULT 0,
    rate              REAL    NOT NULL DEFAULT 0,
    principal_at_time REAL    NOT NULL DEFAULT 0,
    status            TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending', 'paid')),
    paid_date         TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE
  );

  -- ── Transactions (payments & receipts) ──────────────────────────────────
  CREATE TABLE IF NOT EXISTS transactions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id         INTEGER NOT NULL,
    entry_type        TEXT    NOT NULL CHECK(entry_type IN ('payment', 'receipt')),
    amount            REAL    NOT NULL CHECK(amount > 0),
    running_number    TEXT    NOT NULL,
    date              TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    reference         TEXT    NOT NULL DEFAULT '',
    notes             TEXT    NOT NULL DEFAULT '',
    interest_entry_id INTEGER,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id)         REFERENCES ledgers(id) ON DELETE CASCADE,
    FOREIGN KEY (interest_entry_id) REFERENCES interest_entries(id)
  );

  -- ── Settings ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  -- ── Indexes ─────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_ledgers_type            ON ledgers(ledger_type_id);
  CREATE INDEX IF NOT EXISTS idx_ledgers_status          ON ledgers(status);
  CREATE INDEX IF NOT EXISTS idx_interest_entries_ledger  ON interest_entries(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_interest_entries_status  ON interest_entries(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_ledger      ON transactions(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_entry_type  ON transactions(entry_type);
  CREATE INDEX IF NOT EXISTS idx_transactions_date        ON transactions(date);
`;

function up(db) {
  db.exec(SQL);
}

module.exports = { VERSION, up };
