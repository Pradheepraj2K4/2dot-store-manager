/**
 * Migration v20 — Sales rate on items
 *
 * Adds a `sales_rate` column to the `items` table.  When set it is used as
 * the default selling rate in Item Sales Entry instead of MRP.  NULL means
 * "fall back to MRP" (existing behaviour).
 */

const VERSION = 20;

function up(db) {
  db.exec(`
    ALTER TABLE items ADD COLUMN sales_rate REAL;
  `);
}

module.exports = { VERSION, up };
