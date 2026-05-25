/**
 * Migration v16 — Estimations, Sales Returns, Purchase Returns
 *
 * Adds three new transactional document types that mirror the
 * sales / purchases structure (header + line items, GST, discount):
 *
 *   • estimations         — quotation / pro-forma. No stock impact, no
 *                            ledger balance impact. Can later be converted
 *                            into a sale (future).
 *   • sales_returns        — goods returned by a customer. Reverses the
 *                            customer ledger balance (acts like a payment
 *                            received in kind) and restores stock.
 *   • purchase_returns     — goods returned to a supplier. Reduces stock.
 *                            Like purchases, ledger balances are not
 *                            affected; the linked ledger is informational.
 *
 * Optional `*_id` columns reference the originating sale / purchase so the
 * UI can pre-fill line items when raising a return from history.
 */

const VERSION = 16;

const SQL = `
  -- ── Estimations ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS estimations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    estimation_number   TEXT    NOT NULL,
    ledger_id           INTEGER,
    customer_name       TEXT    NOT NULL DEFAULT '',
    date                TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    time                TEXT    NOT NULL DEFAULT (strftime('%H:%M', 'now', 'localtime')),
    valid_until         TEXT    NOT NULL DEFAULT '',
    total_amount        REAL    NOT NULL DEFAULT 0,
    total_discount      REAL    NOT NULL DEFAULT 0,
    total_gst           REAL    NOT NULL DEFAULT 0,
    item_count          INTEGER NOT NULL DEFAULT 0,
    status              TEXT    NOT NULL DEFAULT 'open',  -- open | converted | expired | cancelled
    converted_sale_id   INTEGER,
    notes               TEXT    NOT NULL DEFAULT '',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id)         REFERENCES ledgers(id) ON DELETE SET NULL,
    FOREIGN KEY (converted_sale_id) REFERENCES sales(id)   ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS estimation_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    estimation_id    INTEGER NOT NULL,
    item_id          INTEGER,
    item_name        TEXT    NOT NULL,
    unit             TEXT    NOT NULL DEFAULT 'Nos',
    mrp              REAL    NOT NULL DEFAULT 0,
    rate             REAL    NOT NULL DEFAULT 0,
    quantity         REAL    NOT NULL DEFAULT 1,
    discount_percent REAL    NOT NULL DEFAULT 0,
    gst_percent      REAL    NOT NULL DEFAULT 0,
    gst_amount       REAL    NOT NULL DEFAULT 0,
    amount           REAL    NOT NULL DEFAULT 0,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (estimation_id) REFERENCES estimations(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)       REFERENCES items(id)        ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_estimations_ledger    ON estimations(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_estimations_date      ON estimations(date);
  CREATE INDEX IF NOT EXISTS idx_estimation_items_est  ON estimation_items(estimation_id);
  CREATE INDEX IF NOT EXISTS idx_estimation_items_item ON estimation_items(item_id);

  -- ── Sales Returns ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS sales_returns (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number       TEXT    NOT NULL,
    ledger_id           INTEGER NOT NULL,
    sale_id             INTEGER,
    date                TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    time                TEXT    NOT NULL DEFAULT (strftime('%H:%M', 'now', 'localtime')),
    reason              TEXT    NOT NULL DEFAULT '',
    total_amount        REAL    NOT NULL DEFAULT 0,
    total_discount      REAL    NOT NULL DEFAULT 0,
    total_gst           REAL    NOT NULL DEFAULT 0,
    item_count          INTEGER NOT NULL DEFAULT 0,
    notes               TEXT    NOT NULL DEFAULT '',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id)   REFERENCES sales(id)   ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sales_return_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_return_id   INTEGER NOT NULL,
    item_id           INTEGER,
    item_name         TEXT    NOT NULL,
    unit              TEXT    NOT NULL DEFAULT 'Nos',
    mrp               REAL    NOT NULL DEFAULT 0,
    rate              REAL    NOT NULL DEFAULT 0,
    quantity          REAL    NOT NULL DEFAULT 1,
    discount_percent  REAL    NOT NULL DEFAULT 0,
    gst_percent       REAL    NOT NULL DEFAULT 0,
    gst_amount        REAL    NOT NULL DEFAULT 0,
    amount            REAL    NOT NULL DEFAULT 0,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)         REFERENCES items(id)         ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sales_returns_ledger   ON sales_returns(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_sales_returns_sale     ON sales_returns(sale_id);
  CREATE INDEX IF NOT EXISTS idx_sales_returns_date     ON sales_returns(date);
  CREATE INDEX IF NOT EXISTS idx_sr_items_return        ON sales_return_items(sales_return_id);
  CREATE INDEX IF NOT EXISTS idx_sr_items_item          ON sales_return_items(item_id);

  -- ── Purchase Returns ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS purchase_returns (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number       TEXT    NOT NULL,
    ledger_id           INTEGER NOT NULL,
    purchase_id         INTEGER,
    bill_number         TEXT    NOT NULL DEFAULT '',
    date                TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    time                TEXT    NOT NULL DEFAULT (strftime('%H:%M', 'now', 'localtime')),
    reason              TEXT    NOT NULL DEFAULT '',
    total_amount        REAL    NOT NULL DEFAULT 0,
    total_discount      REAL    NOT NULL DEFAULT 0,
    total_gst           REAL    NOT NULL DEFAULT 0,
    item_count          INTEGER NOT NULL DEFAULT 0,
    notes               TEXT    NOT NULL DEFAULT '',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id)   REFERENCES ledgers(id)   ON DELETE CASCADE,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS purchase_return_items (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_return_id   INTEGER NOT NULL,
    item_id              INTEGER,
    item_name            TEXT    NOT NULL,
    unit                 TEXT    NOT NULL DEFAULT 'Nos',
    mrp                  REAL    NOT NULL DEFAULT 0,
    rate                 REAL    NOT NULL DEFAULT 0,
    quantity             REAL    NOT NULL DEFAULT 1,
    discount_percent     REAL    NOT NULL DEFAULT 0,
    gst_percent          REAL    NOT NULL DEFAULT 0,
    gst_amount           REAL    NOT NULL DEFAULT 0,
    amount               REAL    NOT NULL DEFAULT 0,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)            REFERENCES items(id)            ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_purchase_returns_ledger   ON purchase_returns(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id);
  CREATE INDEX IF NOT EXISTS idx_purchase_returns_date     ON purchase_returns(date);
  CREATE INDEX IF NOT EXISTS idx_pr_items_return           ON purchase_return_items(purchase_return_id);
  CREATE INDEX IF NOT EXISTS idx_pr_items_item             ON purchase_return_items(item_id);
`;

function up(db) {
  db.exec(SQL);
}

function down() {}

module.exports = { VERSION, up, down };
