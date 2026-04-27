/**
 * Database orchestrator
 *
 * Single entry-point that the rest of the application imports.
 * In multi-tenant mode databases are initialised lazily on the first
 * request for each tenant (see connection.js).  This module re-exports
 * the helpers that controllers and repositories depend on so that they
 * do not need to change their import paths.
 */

const { getDb, closeDb, getDbPath, extractTenant, runWithTenant } = require('./connection');

/**
 * No-op kept for backward compatibility.
 * Tenant databases are initialised lazily when the first request arrives.
 */
function initializeDatabase() {
  console.log('[DB] Multi-tenant mode: databases initialised lazily per tenant.');
}

module.exports = { getDb, closeDb, getDbPath, extractTenant, runWithTenant, initializeDatabase };

