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
}

module.exports = new ItemRepository();
