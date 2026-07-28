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
  ['place',      ''],
  ['gst_tax_id', ''],
  ['logo_path',  ''],
  ['phone',      ''],
  ['email',      ''],
  ['upi_id',     ''],
  ['interest_module_enabled', 'false'],
  ['expense_module_enabled', 'false'],
  ['service_module_enabled', 'false'],
  ['restaurant_module_enabled', 'false'],
  ['multi_counter_enabled', 'false'],
  ['purchase_module_enabled', 'true'],
  ['account_transaction_enabled', 'true'],
  ['gst_fields_enabled', 'false'],
  ['cash_tender_enabled', 'true'],
  ['freight_charge_enabled', 'false'],
  ['po_number_enabled', 'false'],
  ['print_receipts_payment_enabled', 'false'],
  ['print_receipts_interest_enabled', 'false'],
  ['print_receipts_sale_enabled', 'false'],
  [
    'receipt_config',
    JSON.stringify({
      format: 'a4',
      header:    { show: true,  title: 'Transaction Receipt', fontSize: 18 },
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
