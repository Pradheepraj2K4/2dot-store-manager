const { getDb } = require('../db/database');

class WaiterRepository {
  getAll({ search, status } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (status) { conds.push('status = ?'); params.push(status); }
    if (search) {
      conds.push('LOWER(name) LIKE ?');
      params.push(`%${String(search).toLowerCase()}%`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT * FROM waiters
      ${where}
      ORDER BY name ASC
    `).all(...params);
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM waiters WHERE id = ?').get(id);
  }

  create({ name }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO waiters (name) VALUES (?)
    `).run(name);
    return this.getById(info.lastInsertRowid);
  }

  update(id, { name, status }) {
    const db = getDb();
    db.prepare(`
      UPDATE waiters
      SET name = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name, status || 'active', id);
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM waiters WHERE id = ?').run(id);
  }

  countSales(id) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS n FROM sales WHERE waiter_id = ?').get(id);
    return row.n;
  }
}

module.exports = new WaiterRepository();
