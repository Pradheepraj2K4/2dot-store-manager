const { getDb } = require('../db/database');

class ItemRepository {
  getAll({ search } = {}) {
    const db = getDb();
    // Subquery: last purchase rate + GST per item (latest purchase date, then latest id)
    const lpJoin = `
      LEFT JOIN (
        SELECT pi.item_id,
               pi.rate        AS last_purchase_rate,
               pi.gst_percent AS last_purchase_gst,
               ROW_NUMBER() OVER (
                 PARTITION BY pi.item_id
                 ORDER BY p.date DESC, p.id DESC, pi.id DESC
               ) AS rn
        FROM purchase_items pi
        INNER JOIN purchases p ON p.id = pi.purchase_id
        WHERE pi.item_id IS NOT NULL
      ) lp ON lp.item_id = i.id AND lp.rn = 1
    `;
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      return db.prepare(`
        SELECT i.*, lp.last_purchase_rate, lp.last_purchase_gst
        FROM items i
        ${lpJoin}
        WHERE i.status = 'active'
          AND (LOWER(i.name) LIKE ?
            OR LOWER(i.brand) LIKE ?
            OR LOWER(i.category) LIKE ?
            OR LOWER(i.item_code) LIKE ?)
        ORDER BY i.name ASC
      `).all(q, q, q, q);
    }
    return db.prepare(`
      SELECT i.*, lp.last_purchase_rate, lp.last_purchase_gst
      FROM items i
      ${lpJoin}
      ORDER BY i.name ASC
    `).all();
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  }

  create({ name, unit, mrp, sales_rate, brand, category, gst_percent, item_code, imei_enabled }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO items (name, unit, mrp, sales_rate, brand, category, gst_percent, item_code, imei_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      (unit || 'Nos').trim(),
      parseFloat(mrp) || 0,
      sales_rate != null && sales_rate !== '' ? parseFloat(sales_rate) : null,
      (brand || '').trim(),
      (category || '').trim(),
      parseFloat(gst_percent) || 0,
      (item_code || '').trim(),
      imei_enabled ? 1 : 0
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, { name, unit, mrp, sales_rate, brand, category, gst_percent, item_code, status, imei_enabled }) {
    const db = getDb();
    db.prepare(`
      UPDATE items
      SET name = ?, unit = ?, mrp = ?, sales_rate = ?, brand = ?, category = ?, gst_percent = ?,
          item_code = ?,
          imei_enabled = ?,
          status = COALESCE(?, status),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name.trim(),
      (unit || 'Nos').trim(),
      parseFloat(mrp) || 0,
      sales_rate != null && sales_rate !== '' ? parseFloat(sales_rate) : null,
      (brand || '').trim(),
      (category || '').trim(),
      parseFloat(gst_percent) || 0,
      (item_code || '').trim(),
      imei_enabled ? 1 : 0,
      status || null,
      id
    );
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM items WHERE id = ?').run(id);
  }

  /**
   * Atomically increment (or decrement, with negative delta) an item's
   * on-hand stock. No-op when itemId is falsy (e.g. ad-hoc lines without a
   * linked item master record).
   */
  adjustStock(itemId, delta) {
    if (!itemId) return;
    const qty = parseFloat(delta);
    if (!qty || isNaN(qty)) return;
    const db = getDb();
    db.prepare(`
      UPDATE items
      SET current_stock = current_stock + ?,
          updated_at    = datetime('now', 'localtime')
      WHERE id = ?
    `).run(qty, itemId);
  }

  /**
   * Overwrite the on-hand stock of multiple items in a single transaction.
   * Each adjustment is `{ id, stock }`; the absolute new value is stored.
   */
  bulkSetStock(adjustments) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE items
      SET current_stock = ?,
          updated_at    = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const run = db.transaction((list) => {
      let updated = 0;
      for (const a of list) {
        const info = stmt.run(a.stock, a.id);
        updated += info.changes;
      }
      return updated;
    });
    return run(adjustments);
  }

  // Distinct brand/category lists for datalist suggestions
  getDistinctBrands() {
    const db = getDb();
    return db.prepare(`
      SELECT DISTINCT brand FROM items
      WHERE brand <> '' ORDER BY brand ASC
    `).all().map((r) => r.brand);
  }

  getDistinctCategories() {
    const db = getDb();
    return db.prepare(`
      SELECT DISTINCT category FROM items
      WHERE category <> '' ORDER BY category ASC
    `).all().map((r) => r.category);
  }

  /**
   * Stock report — for each active item returns the running on-hand stock
   * along with movement summaries (total purchased / sold / returned).
   * Optionally filter by free-text search, brand or category.
   */
  getStockReport({ search, brand, category, lowStockOnly } = {}) {
    const db = getDb();
    const conds = ["i.status = 'active'"];
    const params = [];
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conds.push(`(LOWER(i.name) LIKE ?
                OR LOWER(i.brand) LIKE ?
                OR LOWER(i.category) LIKE ?
                OR LOWER(i.item_code) LIKE ?)`);
      params.push(q, q, q, q);
    }
    if (brand)    { conds.push('i.brand = ?');    params.push(brand); }
    if (category) { conds.push('i.category = ?'); params.push(category); }
    if (lowStockOnly) conds.push('i.current_stock <= 0');

    const where = `WHERE ${conds.join(' AND ')}`;

    return db.prepare(`
      SELECT
        i.id,
        i.item_code,
        i.name,
        i.unit,
        i.brand,
        i.category,
        i.mrp,
        i.gst_percent,
        i.current_stock,
        COALESCE(p.total_purchased, 0)      AS total_purchased,
        COALESCE(s.total_sold, 0)           AS total_sold,
        COALESCE(sr.total_sales_return, 0)  AS total_sales_return,
        COALESCE(pr.total_purchase_return, 0) AS total_purchase_return,
        COALESCE(im.imei_count, 0)          AS imei_count,
        (i.mrp * i.current_stock)           AS stock_value
      FROM items i
      LEFT JOIN (
        SELECT item_id, SUM(quantity) AS total_purchased
        FROM purchase_items WHERE item_id IS NOT NULL GROUP BY item_id
      ) p ON p.item_id = i.id
      LEFT JOIN (
        SELECT item_id, SUM(quantity) AS total_sold
        FROM sale_items WHERE item_id IS NOT NULL GROUP BY item_id
      ) s ON s.item_id = i.id
      LEFT JOIN (
        SELECT item_id, SUM(quantity) AS total_sales_return
        FROM sales_return_items WHERE item_id IS NOT NULL GROUP BY item_id
      ) sr ON sr.item_id = i.id
      LEFT JOIN (
        SELECT item_id, SUM(quantity) AS total_purchase_return
        FROM purchase_return_items WHERE item_id IS NOT NULL GROUP BY item_id
      ) pr ON pr.item_id = i.id
      LEFT JOIN (
        SELECT item_id, COUNT(*) AS imei_count
        FROM item_imeis GROUP BY item_id
      ) im ON im.item_id = i.id
      ${where}
      ORDER BY i.name ASC
    `).all(...params);
  }
}

module.exports = new ItemRepository();
