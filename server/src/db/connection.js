const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');

// DATA_DIR is injected by the Electron wrapper when running packaged,
// pointing to resources/data beside app.exe so the .db can be replaced freely.
const DB_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

// Per-tenant connection pool
const connections = new Map();

// Stores the current tenant name for the lifetime of each request
const tenantStorage = new AsyncLocalStorage();

/**
 * Extracts the tenant identifier from an HTTP hostname.
 * Expected pattern:  accounts-{tenant}.2dotloanmanager.in  →  tenant
 * Falls back to 'trial' for any unrecognised hostname.
 */
function extractTenant(hostname) {
  if (!hostname) return 'trial';
  const match = hostname.match(/^accounts-([a-z0-9_-]+)\./i);
  if (match) return match[1].toLowerCase();
  return 'trial';
}

/**
 * Validates a tenant name to prevent path traversal and injection.
 * Only lowercase alphanumeric, hyphens, and underscores are allowed (max 64 chars).
 */
function isValidTenant(name) {
  return /^[a-z0-9_-]{1,64}$/.test(name);
}

/**
 * Returns the absolute path to the SQLite file for a given tenant.
 * When called with no argument it resolves the current request's tenant
 * from AsyncLocalStorage.
 */
function getDbPath(tenant) {
  const resolved = tenant || tenantStorage.getStore() || 'trial';
  const safe = isValidTenant(resolved) ? resolved : 'trial';
  return path.join(DB_DIR, `${safe}.db`);
}

/**
 * Returns the better-sqlite3 instance for the current tenant.
 * The tenant is taken from AsyncLocalStorage (set by the tenant middleware).
 * On first access the DB file is created and all migrations + seeds are applied.
 */
function getDb() {
  const tenant = tenantStorage.getStore() || 'trial';

  if (!connections.has(tenant)) {
    if (!isValidTenant(tenant)) {
      throw new Error(`Invalid tenant name: "${tenant}"`);
    }
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const dbPath = getDbPath(tenant);
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    connections.set(tenant, db);

    // Lazy-require to avoid circular dependency at module load time
    const { runMigrations } = require('./migrations');
    const { seedSettings }  = require('./seeds/settings');
    runMigrations(db);
    seedSettings(db);
    console.log(`[DB] Tenant "${tenant}" ready → ${dbPath}`);
  }

  return connections.get(tenant);
}

/**
 * Runs callback() inside the async context of the given tenant.
 * All downstream code (including `getDb()`) will see that tenant.
 *
 * @param {string}   tenant   - Tenant identifier (validated internally).
 * @param {Function} callback - Function to call within the tenant context.
 */
function runWithTenant(tenant, callback) {
  const safe = (isValidTenant(tenant)) ? tenant : 'trial';
  return tenantStorage.run(safe, callback);
}

/**
 * Closes all open database connections (clean shutdown / tests).
 */
function closeDb() {
  for (const db of connections.values()) {
    db.close();
  }
  connections.clear();
}

module.exports = { getDb, closeDb, getDbPath, extractTenant, runWithTenant };
