/**
 * Migration v26 — Service module (staffs + services)
 *
 * Adds support for an optional "Service" module:
 *
 *   • staffs   — a lightweight master of staff members (name only for now)
 *                used to record who performed a service.
 *
 *   • services — service jobs raised against a customer/ledger. A service
 *                starts in the `pending` state when entered and moves to
 *                `closed` once it is completed. Closing captures the material
 *                and labour cost; the amount to collect is
 *                (material_cost + labour_cost - advance_amount).
 *
 * The module is gated behind the `service_module_enabled` setting.
 */

const VERSION = 26;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staffs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'active',
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      service_number  TEXT    NOT NULL UNIQUE,
      ledger_id       INTEGER NOT NULL,
      date            TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
      item_id         INTEGER,
      item_name       TEXT    NOT NULL,
      quantity        REAL    NOT NULL DEFAULT 1,
      imei            TEXT    NOT NULL DEFAULT '',
      staff_id        INTEGER,
      staff_name      TEXT    NOT NULL DEFAULT '',
      advance_amount  REAL    NOT NULL DEFAULT 0,
      customer_name   TEXT    NOT NULL DEFAULT '',
      customer_mobile TEXT    NOT NULL DEFAULT '',
      customer_place  TEXT    NOT NULL DEFAULT '',
      remarks         TEXT    NOT NULL DEFAULT '',
      status          TEXT    NOT NULL DEFAULT 'pending',
      material_cost   REAL    NOT NULL DEFAULT 0,
      labour_cost     REAL    NOT NULL DEFAULT 0,
      collect_amount  REAL    NOT NULL DEFAULT 0,
      closing_remarks TEXT    NOT NULL DEFAULT '',
      closed_at       TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (ledger_id) REFERENCES ledgers(id),
      FOREIGN KEY (item_id)   REFERENCES items(id),
      FOREIGN KEY (staff_id)  REFERENCES staffs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_services_status_date ON services(status, date);
    CREATE INDEX IF NOT EXISTS idx_services_ledger ON services(ledger_id);
  `);
}

module.exports = { VERSION, up };
