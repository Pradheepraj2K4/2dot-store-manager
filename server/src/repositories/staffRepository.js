const { getDb } = require('../db/database');

class StaffRepository {
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
      SELECT * FROM staffs
      ${where}
      ORDER BY name ASC
    `).all(...params);
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM staffs WHERE id = ?').get(id);
  }

  create({ name }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO staffs (name) VALUES (?)
    `).run(name);
    return this.getById(info.lastInsertRowid);
  }

  update(id, { name, status }) {
    const db = getDb();
    db.prepare(`
      UPDATE staffs
      SET name = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name, status || 'active', id);
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM staffs WHERE id = ?').run(id);
  }

  countServices(id) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS n FROM services WHERE staff_id = ?').get(id);
    return row.n;
  }
}

module.exports = new StaffRepository();
