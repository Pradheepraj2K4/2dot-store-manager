/**
 * Migration v5 — remove legacy default expense categories for empty ledgers
 *
 * Older builds pre-seeded system categories. This migration removes those
 * defaults only when there are no expense records yet, so new setups start
 * with an empty, user-defined category list.
 */

const VERSION = 5;

const LEGACY_DEFAULTS = [
  'Salary',
  'Stationery',
  'Utilities',
  'Transport',
  'Miscellaneous',
];

function up(db) {
  const expenseCount = db.prepare('SELECT COUNT(*) AS count FROM expenses').get().count;
  if (expenseCount > 0) return;

  const placeholders = LEGACY_DEFAULTS.map(() => '?').join(', ');
  db.prepare(`DELETE FROM expense_categories WHERE name IN (${placeholders})`).run(...LEGACY_DEFAULTS);
}

module.exports = { VERSION, up };
