/**
 * Migration v10 — Transaction Categories
 *
 * Introduces a `transaction_categories` table so users can categorise
 * payments and receipts. Also adds a nullable `category_id` FK column
 * to the `transactions` table.
 */

const VERSION = 10;

function up(db) {
  // 1. Create the transaction_categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 2. Add category_id to transactions (nullable FK)
  try {
    db.exec(`ALTER TABLE transactions ADD COLUMN category_id INTEGER REFERENCES transaction_categories(id);`);
  } catch (_) {
    // Column already exists — safe to ignore
  }
}

function down() {}

module.exports = { VERSION, up, down };
