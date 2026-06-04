/**
 * Migration v21 — Cash sale customer place
 *
 * Adds a `customer_place` column to the `sales` table so that walk-in (CASH)
 * sales can capture the buyer's place/location alongside name and mobile.
 *
 * Defaults to '' so all existing records remain unchanged.
 */

const VERSION = 21;

function up(db) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN customer_place TEXT NOT NULL DEFAULT '';
  `);
}

module.exports = { VERSION, up };
