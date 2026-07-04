/**
 * Migration v30 — Restaurant module (waiters + item A/C rates + sale service type)
 *
 * Adds support for an optional "Restaurant" module, gated behind the
 * `restaurant_module_enabled` setting:
 *
 *   • waiters — a lightweight master of waiters (name only, mirrors staffs)
 *               used to record which waiter served a bill.
 *
 *   • items.ac_rate / items.non_ac_rate — optional fixed selling rates that
 *               apply when a bill is billed as A/C or Non-A/C respectively.
 *               Nullable; when absent the normal sales_rate / MRP is used.
 *
 *   • sales.waiter_id / waiter_name / service_type — capture the waiter and
 *               whether the bill was A/C or Non-A/C. service_type is one of
 *               '' (not a restaurant bill), 'ac', or 'non_ac'.
 */

const VERSION = 30;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS waiters (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'active',
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    ALTER TABLE items ADD COLUMN ac_rate     REAL;
    ALTER TABLE items ADD COLUMN non_ac_rate REAL;

    ALTER TABLE sales ADD COLUMN waiter_id    INTEGER;
    ALTER TABLE sales ADD COLUMN waiter_name  TEXT NOT NULL DEFAULT '';
    ALTER TABLE sales ADD COLUMN service_type TEXT NOT NULL DEFAULT '';
  `);
}

module.exports = { VERSION, up };
