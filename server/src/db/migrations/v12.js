/**
 * Migration v12 — Add GST fields to sale_items and total_gst to sales
 *
 * Changes:
 *  - sale_items: adds gst_percent (rate %) and gst_amount (computed GST value per line)
 *  - sales:      adds total_gst (sum of all line gst_amounts)
 */

const VERSION = 12;

function up(db) {
  // Use separate executions since SQLite doesn't support multi-column ADD in one ALTER
  db.exec(`ALTER TABLE sale_items ADD COLUMN gst_percent REAL NOT NULL DEFAULT 0`);
  db.exec(`ALTER TABLE sale_items ADD COLUMN gst_amount  REAL NOT NULL DEFAULT 0`);
  db.exec(`ALTER TABLE sales      ADD COLUMN total_gst   REAL NOT NULL DEFAULT 0`);
}

function down() {}

module.exports = { VERSION, up, down };
