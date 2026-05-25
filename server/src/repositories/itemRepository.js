const { getDb } = require('../db/database');

class ItemRepository {
  getAll({ search } = {}) {
    const db = getDb();
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      return db.prepare(`
        SELECT * FROM items
        WHERE status = 'active'
          AND (LOWER(name) LIKE ?
            OR LOWER(brand) LIKE ?
            OR LOWER(category) LIKE ?
            OR LOWER(item_code) LIKE ?)
        ORDER BY name ASC
      `).all(q, q, q, q);
    }
    return db.prepare(`SELECT * FROM items ORDER BY name ASC`).all();
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  }

  create({ name, unit, mrp, brand, category, gst_percent, item_code }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO items (name, unit, mrp, brand, category, gst_percent, item_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      (unit || 'Nos').trim(),
      parseFloat(mrp) || 0,
      (brand || '').trim(),
      (category || '').trim(),
      parseFloat(gst_percent) || 0,
      (item_code || '').trim()
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, { name, unit, mrp, brand, category, gst_percent, item_code, status }) {
    const db = getDb();
    db.prepare(`
      UPDATE items
      SET name = ?, unit = ?, mrp = ?, brand = ?, category = ?, gst_percent = ?,
          item_code = ?,
          status = COALESCE(?, status),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name.trim(),
      (unit || 'Nos').trim(),
      parseFloat(mrp) || 0,
      (brand || '').trim(),
      (category || '').trim(),
      parseFloat(gst_percent) || 0,
      (item_code || '').trim(),
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
      ${where}
      ORDER BY i.name ASC
    `).all(...params);
  }
}

module.exports = new ItemRepository();
