/**
 * Migration v8 — Add interest_number to interest_entries
 *
 * Adds a unique human-readable ID (INT-00001 format) to every interest entry
 * so receipts can reference a stable receipt number.  Existing rows are
 * back-filled in ascending id order.
 */

const VERSION = 8;

function up(db) {
  const cols = db.pragma('table_info(interest_entries)').map(c => c.name);
  if (!cols.includes('interest_number')) {
    db.exec(`ALTER TABLE interest_entries ADD COLUMN interest_number TEXT NOT NULL DEFAULT '';`);
  }

  // Back-fill all existing rows with sequential numbers
  const entries = db.prepare('SELECT id FROM interest_entries ORDER BY id ASC').all();
  const update  = db.prepare('UPDATE interest_entries SET interest_number = ? WHERE id = ?');
  entries.forEach((e, i) => {
    update.run(`INT-${String(i + 1).padStart(5, '0')}`, e.id);
  });
}

function down() {}

module.exports = { VERSION, up, down };
