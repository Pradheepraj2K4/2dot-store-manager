/**
 * Migration v14 — Purchases module + stock tracking on items
 *
 * Changes:
 *  - items: adds `current_stock` (REAL) — running on-hand stock; increases
 *    on purchase, decreases on sale.
 *  - purchases: header table for purchase invoices. Mirrors sales but
 *    intentionally DOES NOT affect ledger balances. A ledger (typically a
 *    supplier) is selected for record-keeping/reporting only.
 *    Adds an optional `bill_number` for the supplier's invoice reference.
 *  - purchase_items: line items inside a purchase, mirrors sale_items.
 */

const VERSION = 14;

const SQL = `
  -- ── Stock column on items master ───────────────────────────────────────
  ALTER TABLE items ADD COLUMN current_stock REAL NOT NULL DEFAULT 0;

  -- ── Purchases (invoice header) ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS purchases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT    NOT NULL,
    ledger_id       INTEGER NOT NULL,
    bill_number     TEXT    NOT NULL DEFAULT '',
    date            TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    time            TEXT    NOT NULL DEFAULT (strftime('%H:%M', 'now', 'localtime')),
    total_amount    REAL    NOT NULL DEFAULT 0,
    total_discount  REAL    NOT NULL DEFAULT 0,
    total_gst       REAL    NOT NULL DEFAULT 0,
    item_count      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE
  );

  -- ── Purchase line items ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS purchase_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id      INTEGER NOT NULL,
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
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)     REFERENCES items(id)     ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_ledger    ON purchases(ledger_id);
  CREATE INDEX IF NOT EXISTS idx_purchases_date      ON purchases(date);
  CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
  CREATE INDEX IF NOT EXISTS idx_purchase_items_item     ON purchase_items(item_id);
`;

function up(db) {
  db.exec(SQL);

  // Backfill stock from existing transactions so the running balance is
  // consistent with history once the column comes online. Purchases don't
  // exist yet (new table), so stock = -sum(sale_items.quantity).
  const adjustments = db.prepare(`
    SELECT item_id, COALESCE(SUM(quantity), 0) AS sold
    FROM sale_items
    WHERE item_id IS NOT NULL
    GROUP BY item_id
  `).all();

  const upd = db.prepare('UPDATE items SET current_stock = ? WHERE id = ?');
  for (const row of adjustments) {
    upd.run(-1 * (parseFloat(row.sold) || 0), row.item_id);
  }
}

function down() {}

module.exports = { VERSION, up, down };
