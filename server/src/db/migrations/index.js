/**
 * Migration runner
 *
 * Manages the `schema_version` table and applies any pending migrations
 * in strict ascending version order.
 *
 * How it works
 * ─────────────
 *  1. Bootstrap — ensures `schema_version` exists (version 0 if brand new).
 *  2. Read      — queries the current version from the table.
 *  3. Diff      — collects every registered migration with VERSION > current.
 *  4. Apply     — runs each migration's `up(db)` inside its own transaction
 *                 and advances the stored version atomically.
 *
 * Adding a new migration
 * ──────────────────────
 *  1. Create  server/src/db/migrations/v<N>.js  exporting { VERSION, up }.
 *  2. Import it below and add it to the MIGRATIONS array (keep sorted).
 *  3. The runner will detect the version gap and apply it automatically on
 *     the next server start.
 */

const v1 = require('./v1');
const v2 = require('./v2');
const v3 = require('./v3');
const v4 = require('./v4');
const v5 = require('./v5');
const v6 = require('./v6');
const v7 = require('./v7');
const v8 = require('./v8');
const v9 = require('./v9');
const v10 = require('./v10');
const v11 = require('./v11');
const v12 = require('./v12');
const v13 = require('./v13');
const v14 = require('./v14');
const v15 = require('./v15');
const v16 = require('./v16');
const v17 = require('./v17');
const v18 = require('./v18');
const v19 = require('./v19');

// ── Register all migrations here, sorted by VERSION ascending ──────────────
const MIGRATIONS = [
  v1,
  v2,
  v3,
  v4,
  v5,
  v6,
  v7,
  v8,
  v9,
  v10,
  v11,
  v12,
  v13,
  v14,
  v15,
  v16,
  v17,
  v18,
  v19,
  // v20, … add future migrations here
];

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the schema_version control table if it does not yet exist and
 * inserts the initial row (version = 0) for a brand-new database.
 */
function bootstrapVersionTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id         INTEGER PRIMARY KEY CHECK(id = 1),
      version    INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0);
  `);
}

/**
 * Returns the integer version currently stored in the database.
 */
function getCurrentVersion(db) {
  return db.prepare('SELECT version FROM schema_version WHERE id = 1').get().version;
}

/**
 * Persists the new version number inside the same transaction as the migration.
 */
function setVersion(db, version) {
  db.prepare(`
    UPDATE schema_version
    SET version = ?, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(version);
}

/**
 * Runs all pending migrations against the supplied better-sqlite3 instance.
 * Safe to call on every startup — already-applied migrations are skipped.
 */
function runMigrations(db) {
  bootstrapVersionTable(db);

  const currentVersion = getCurrentVersion(db);
  const pending = MIGRATIONS
    .filter(m => m.VERSION > currentVersion)
    .sort((a, b) => a.VERSION - b.VERSION);

  if (pending.length === 0) {
    console.log(`[DB] Schema is up to date (version ${currentVersion}).`);
    return;
  }

  for (const migration of pending) {
    console.log(`[DB] Applying migration v${migration.VERSION}…`);
    const apply = db.transaction(() => {
      migration.up(db);
      setVersion(db, migration.VERSION);
    });
    apply();
    console.log(`[DB] Migration v${migration.VERSION} applied successfully.`);
  }

  const newVersion = getCurrentVersion(db);
  console.log(`[DB] Schema updated to version ${newVersion}.`);
}

module.exports = { runMigrations };
