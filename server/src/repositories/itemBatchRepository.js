const { getDb } = require("../db/database");

/**
 * Item batch repository.
 *
 * A batch is a distinct lot of an item (identified by item_id + batch_no)
 * carrying its own price and on-hand stock. Batches are created/topped-up by
 * purchases and drawn down by sales when the batch feature is enabled.
 */
class ItemBatchRepository {
  /** All batches for an item, latest (most recently created) first. */
  getByItem(itemId) {
    const db = getDb();
    return db
      .prepare(
        `
      SELECT * FROM item_batches
      WHERE item_id = ?
      ORDER BY id DESC
    `,
      )
      .all(itemId);
  }

  getById(id) {
    const db = getDb();
    return db.prepare("SELECT * FROM item_batches WHERE id = ?").get(id);
  }

  findByItemAndNo(itemId, batchNo) {
    const db = getDb();
    return db
      .prepare("SELECT * FROM item_batches WHERE item_id = ? AND batch_no = ?")
      .get(itemId, String(batchNo).trim());
  }

  create({
    item_id,
    batch_no,
    mrp,
    rate,
    sales_rate,
    gst_percent,
    current_stock,
    purchase_id,
  }) {
    const db = getDb();
    const info = db
      .prepare(
        `
      INSERT INTO item_batches (item_id, batch_no, mrp, rate, sales_rate, gst_percent, current_stock, purchase_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        item_id,
        String(batch_no).trim(),
        parseFloat(mrp) || 0,
        parseFloat(rate) || 0,
        sales_rate != null && sales_rate !== "" ? parseFloat(sales_rate) : null,
        parseFloat(gst_percent) || 0,
        parseFloat(current_stock) || 0,
        purchase_id || null,
      );
    return this.getById(info.lastInsertRowid);
  }

  /** Refresh a batch's price metadata (used when a batch is re-purchased). */
  updateMeta(id, { mrp, rate, sales_rate, gst_percent }) {
    const db = getDb();
    db.prepare(
      `
      UPDATE item_batches
      SET mrp = ?, rate = ?, sales_rate = ?, gst_percent = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `,
    ).run(
      parseFloat(mrp) || 0,
      parseFloat(rate) || 0,
      sales_rate != null && sales_rate !== "" ? parseFloat(sales_rate) : null,
      parseFloat(gst_percent) || 0,
      id,
    );
    return this.getById(id);
  }

  /** Atomically add (negative to subtract) to a batch's on-hand stock. */
  adjustStock(id, delta) {
    if (!id) return;
    const qty = parseFloat(delta);
    if (!qty || isNaN(qty)) return;
    const db = getDb();
    db.prepare(
      `
      UPDATE item_batches
      SET current_stock = current_stock + ?,
          updated_at    = datetime('now', 'localtime')
      WHERE id = ?
    `,
    ).run(qty, id);
  }

  /**
   * Next auto batch number for the given prefix. Scans existing batch numbers
   * that start with the prefix, extracts the trailing integer and returns the
   * prefix followed by max+1 (starting at 1), zero-padded to 4 digits
   * (e.g. "BAT-0001"). Numbers beyond 9999 are left un-truncated.
   */
  getNextAutoNumber(prefix = "") {
    const db = getDb();
    const p = String(prefix || "");
    const rows = db
      .prepare(`SELECT batch_no FROM item_batches WHERE batch_no LIKE ?`)
      .all(`${p}%`);
    let max = 0;
    for (const r of rows) {
      const suffix = String(r.batch_no).slice(p.length);
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return `${p}${String(max + 1).padStart(4, "0")}`;
  }
}

module.exports = new ItemBatchRepository();
