/**
 * Migration v28 — Multiple items per service
 *
 * The original Service module recorded a single item per service job (stored
 * inline on the `services` table). This migration introduces a child table so
 * a single service can list multiple serviced items, each with its own
 * quantity, IMEI / serial and the staff member who handled it.
 *
 *   • service_items — one row per item on a service. The `services` table keeps
 *                     its legacy item columns populated with the FIRST item as a
 *                     summary so existing list / search screens keep working.
 *
 * Existing single-item services are backfilled into `service_items`.
 */

const VERSION = 28;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id  INTEGER NOT NULL,
      item_id     INTEGER,
      item_name   TEXT    NOT NULL,
      quantity    REAL    NOT NULL DEFAULT 1,
      imei        TEXT    NOT NULL DEFAULT '',
      staff_id    INTEGER,
      staff_name  TEXT    NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id)    REFERENCES items(id)     ON DELETE SET NULL,
      FOREIGN KEY (staff_id)   REFERENCES staffs(id)    ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_service_items_service ON service_items(service_id);
    CREATE INDEX IF NOT EXISTS idx_service_items_item    ON service_items(item_id);
  `);

  // Backfill: copy each existing service's inline item into service_items.
  const services = db.prepare(`
    SELECT id, item_id, item_name, quantity, imei, staff_id, staff_name
    FROM services
  `).all();

  const insert = db.prepare(`
    INSERT INTO service_items
      (service_id, item_id, item_name, quantity, imei, staff_id, staff_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  for (const s of services) {
    // Skip if this service already has child rows (idempotent safety).
    const existing = db.prepare('SELECT COUNT(*) AS n FROM service_items WHERE service_id = ?').get(s.id);
    if (existing && existing.n > 0) continue;
    insert.run(
      s.id,
      s.item_id || null,
      s.item_name || '',
      s.quantity || 1,
      s.imei || '',
      s.staff_id || null,
      s.staff_name || ''
    );
  }
}

module.exports = { VERSION, up };
