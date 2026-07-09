/**
 * Migration v32 — Rate & bill-discount edit permissions
 *
 * Adds two granular permission columns to the `users` table so operators can
 * be individually allowed (or blocked) from editing the item Rate and the Bill
 * Discount on the Sales Entry screen. Both default to 0 (disabled) — access is
 * opt-in, matching the other permission columns. The built-in Admin identity is
 * not stored here and always has full access.
 */

const VERSION = 32;

function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN can_edit_rate          INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN can_edit_bill_discount INTEGER NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
