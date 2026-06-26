/**
 * Migration v27 — Customers master
 *
 * Adds a dedicated, lightweight customer directory so that walk-in / retail
 * buyers can be retained and reused across sales without needing a full
 * accounting ledger.
 *
 *   • customers — name + mobile (unique) + place/address/email. The 10-digit
 *                 mobile number is the natural key used to implicitly decide
 *                 whether a buyer is new or existing. A partial UNIQUE index
 *                 enforces uniqueness only for non-empty mobiles so records
 *                 without a number remain allowed.
 *
 *   • sales.customer_id — nullable link from a sale to the customer it was
 *                 billed to. The existing customer_name / customer_mobile /
 *                 customer_place snapshot columns are kept untouched.
 */

const VERSION = 27;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      mobile     TEXT    NOT NULL DEFAULT '',
      place      TEXT    NOT NULL DEFAULT '',
      address    TEXT    NOT NULL DEFAULT '',
      email      TEXT    NOT NULL DEFAULT '',
      notes      TEXT    NOT NULL DEFAULT '',
      status     TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Mobile is the de-duplication key. Allow many blank mobiles but keep
    -- real numbers unique so the system can resolve existing vs new buyers.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_mobile
      ON customers(mobile) WHERE mobile != '';

    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  `);

  // Link sales to a retained customer (nullable — legacy/CASH sales may have none).
  const cols = db.prepare(`PRAGMA table_info(sales)`).all();
  if (!cols.some((c) => c.name === 'customer_id')) {
    db.exec(`ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id);`);
  }
}

module.exports = { VERSION, up };
