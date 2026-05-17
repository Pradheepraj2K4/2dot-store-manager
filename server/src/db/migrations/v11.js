/**
 * Migration v11 — Items master and Item Sales
 *
 * Tables:
 *  - items        : product master (auto-incremented item id)
 *  - sales        : sale invoice header tied to a customer ledger
 *  - sale_items   : line items within a sale
 *
 * Behaviour: a sale debits the customer ledger (increases current_balance).
 * The balance update itself is handled in the sale service layer.
 */

const VERSION = 11;

const SQL = `
  -- ── Items master ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    unit       TEXT    NOT NULL DEFAULT 'Nos',
    mrp        REAL    NOT NULL DEFAULT 0,
    brand      TEXT    NOT NULL DEFAULT '',
    category   TEXT    NOT NULL DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- ── Sales (invoice header) ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS sales (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number   TEXT    NOT NULL,
    ledger_id     INTEGER NOT NULL,
    date          TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    time          TEXT    NOT NULL DEFAULT (strftime('%H:%M', 'now', 'localtime')),
    total_amount  REAL    NOT NULL DEFAULT 0,
    total_discount REAL   NOT NULL DEFAULT 0,
    item_count    INTEGER NOT NULL DEFAULT 0,
    notes         TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE
  );

  -- ── Sale line items ────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS sale_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id          INTEGER NOT NULL,
    item_id          INTEGER,
    item_name        TEXT    NOT NULL,
    unit             TEXT    NOT NULL DEFAULT 'Nos',
    mrp              REAL    NOT NULL DEFAULT 0,
    rate             REAL    NOT NULL DEFAULT 0,
    quantity         REAL    NOT NULL DEFAULT 1,
    discount_percent REAL    NOT NULL DEFAULT 0,
    amount           REAL    NOT NULL DEFAULT 0,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_name        ON items(name);
  CREATE INDEX IF NOT EXISTS idx_items_brand       ON items(brand);
  CREATE INDEX IF NOT EXISTS idx_items_category    ON items(category);
  CREATE INDEX IF NOT EXISTS idx_sales_ledger      ON sales(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_sales_date        ON sales(date);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale   ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_sale_items_item   ON sale_items(item_id);
`;

function up(db) {
  db.exec(SQL);
}

function down() {}

module.exports = { VERSION, up, down };
