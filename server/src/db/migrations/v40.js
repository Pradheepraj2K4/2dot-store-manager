/**
 * Migration v40 — Unit master
 *
 * Adds a `units` table so operators can manage the list of measurement units
 * (Nos, Kg, Ltr, …) used when creating items, instead of relying on a fixed
 * hard-coded list. The table is seeded with the previously hard-coded defaults
 * so existing items keep working unchanged.
 *
 *   • units.name — the unit label; kept unique (case-insensitive).
 */

const VERSION = 40;

const DEFAULT_UNITS = ['Nos', 'Kg', 'Gm', 'Ltr', 'Ml', 'Mtr', 'Pkt', 'Box'];

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_units_name_nocase ON units (name COLLATE NOCASE);
  `);

  const insert = db.prepare('INSERT OR IGNORE INTO units (name) VALUES (?)');
  for (const name of DEFAULT_UNITS) {
    insert.run(name);
  }
}

module.exports = { VERSION, up };
