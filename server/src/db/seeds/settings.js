/**
 * Default settings seed
 *
 * Inserts the application's default key-value settings rows on a fresh
 * database.  Uses INSERT OR IGNORE so re-running on an existing database
 * is completely safe — existing customised values are never overwritten.
 */

const DEFAULT_SETTINGS = [
  ['store_name', '2Dot Inventory'],
  ['address',    ''],
  ['gst_tax_id', ''],
  ['logo_path',  ''],
  ['phone',      ''],
  ['email',      ''],
  ['interest_module_enabled', 'false'],
  [
    'receipt_config',
    JSON.stringify({
      format: 'a4',
      header:    { show: true,  title: 'Payment Receipt', fontSize: 18 },
      footer:    { show: true,  text: 'Thank you for your business!', fontSize: 10 },
      body:      { fontSize: 12 },
      showLogo:  false,
      showGst:   true,
      paperWidth:  210,
      paperHeight: 297,
    }),
  ],
];

/**
 * Inserts default settings into the database.
 * Existing rows are left untouched (INSERT OR IGNORE).
 *
 * @param {import('better-sqlite3').Database} db
 */
function seedSettings(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );

  const run = db.transaction(() => {
    for (const [key, value] of DEFAULT_SETTINGS) {
      insert.run(key, value);
    }
  });

  run();
}

module.exports = { seedSettings };
