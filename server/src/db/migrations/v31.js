/**
 * Migration v31 — Default waiter
 *
 * Adds an `is_default` flag to the `waiters` master so one waiter can be
 * marked as the default. When a new restaurant bill is started, the default
 * waiter is pre-selected. At most one waiter should carry is_default = 1;
 * this is enforced in the repository layer.
 */

const VERSION = 31;

function up(db) {
  db.exec(`
    ALTER TABLE waiters ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
