/**
 * Database Backup Service
 *
 * Copies the live inventory.db to a user-specified backup directory
 * with a date-stamped filename: inventory_DD-MM-YYYY.db
 *
 * - triggerDailyBackup()  — called after every write; skips if today's backup already exists
 * - triggerBackupNow()    — forces a backup (used by "Backup Now" button)
 */

const fs   = require('fs');
const path = require('path');
const { getDbPath } = require('../db/connection');

function getTodayDateString() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getBackupSettings() {
  // Lazy-require to avoid circular dependency at module load time
  const settingsRepository = require('../repositories/settingsRepository');
  const enabled = settingsRepository.get('backup_enabled');
  const dir     = settingsRepository.get('backup_dir');
  return {
    enabled: enabled === true || enabled === 'true',
    dir: dir || '',
  };
}

function performBackup(backupDir) {
  if (!backupDir) {
    return { success: false, error: 'No backup directory configured' };
  }
  if (!fs.existsSync(backupDir)) {
    return { success: false, error: `Backup directory does not exist: ${backupDir}` };
  }
  const dateStr  = getTodayDateString();
  const destPath = path.join(backupDir, `inventory_${dateStr}.db`);
  try {
    // Resolve the current tenant's DB file via AsyncLocalStorage context
    fs.copyFileSync(getDbPath(), destPath);
    return { success: true, path: destPath, date: dateStr };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Best-effort daily backup. Only runs if:
 *  - backup is enabled in settings
 *  - a backup directory is configured
 *  - today's backup file does not already exist
 */
function triggerDailyBackup() {
  try {
    const { enabled, dir } = getBackupSettings();
    if (!enabled || !dir) return;

    const dateStr  = getTodayDateString();
    const destPath = path.join(dir, `inventory_${dateStr}.db`);
    if (fs.existsSync(destPath)) return; // already done today

    performBackup(dir);
  } catch (_) {
    // Silently swallow — backup is best-effort and must never crash the app
  }
}

/**
 * Forced backup — always overwrites today's backup file.
 * Returns a result object { success, path?, date?, error? }.
 */
function triggerBackupNow() {
  const { dir } = getBackupSettings();
  return performBackup(dir);
}

module.exports = { triggerDailyBackup, triggerBackupNow };
