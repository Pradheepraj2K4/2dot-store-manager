/**
 * Migration v4 — Expense Module
 *
 * Tables: expense_categories, expenses
 */

const VERSION = 4;

const SQL = `
  -- ── Expense Categories ──────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS expense_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- ── Expenses ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS expenses (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_name        TEXT    NOT NULL,
    expense_category_id INTEGER,
    amount              REAL    NOT NULL CHECK(amount > 0),
    date                TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    notes               TEXT    NOT NULL DEFAULT '',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id)
  );

  -- ── Indexes ─────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(expense_category_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_name     ON expenses(expense_name);
`;

function up(db) {
  db.exec(SQL);
}

module.exports = { VERSION, up };
