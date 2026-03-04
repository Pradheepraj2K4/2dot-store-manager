/**
 * Database orchestrator
 *
 * Single entry-point that the rest of the application imports.
 * Responsibilities:
 *   1. Open the SQLite connection (via connection.js).
 *   2. Run pending schema migrations (via migrations/index.js).
 *   3. Seed required default data (via seeds/settings.js).
 *
 * All other modules that need the DB instance should import `getDb` from
 * this file (re-exported from connection.js) so there is one canonical path.
 */

const { getDb, closeDb }   = require('./connection');
const { runMigrations }    = require('./migrations');
const { seedSettings }     = require('./seeds/settings');

/**
 * Initialises the database.
 * Called once at application startup (server/src/index.js).
 */
function initializeDatabase() {
  const db = getDb();
  runMigrations(db);
  seedSettings(db);
  console.log('[DB] Database ready.');
}

module.exports = { getDb, closeDb, initializeDatabase };

