/**
 * Migration v23 — Application users
 *
 * Adds a `users` table so that additional (non-admin) operators can be created
 * with their own password and a set of granular permissions. Each permission
 * is a boolean column that defaults to 0 (disabled) — access is opt-in.
 *
 * The built-in "Admin" identity is NOT stored here; it continues to authenticate
 * with the date-based developer password and the custom password configured in
 * settings, and always has full access.
 */

const VERSION = 23;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      username            TEXT    NOT NULL UNIQUE,
      password            TEXT    NOT NULL,
      can_create          INTEGER NOT NULL DEFAULT 0,
      can_modify          INTEGER NOT NULL DEFAULT 0,
      can_delete          INTEGER NOT NULL DEFAULT 0,
      can_manage_settings INTEGER NOT NULL DEFAULT 0,
      status              TEXT    NOT NULL DEFAULT 'active',
      created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

module.exports = { VERSION, up };
