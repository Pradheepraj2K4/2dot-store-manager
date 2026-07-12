/**
 * Migration v34 — Restaurant dining type
 *
 * Captures whether a restaurant bill is served for Dining or Take-away,
 * independent of the A/C vs Non-A/C service type:
 *
 *   • sales.dining_type — one of 'dining' (default) or 'take_away'.
 *
 * Defaults to 'dining' for existing rows.
 */

const VERSION = 34;

function up(db) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN dining_type TEXT NOT NULL DEFAULT 'dining';
  `);
}

module.exports = { VERSION, up };
