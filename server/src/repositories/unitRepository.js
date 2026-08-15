const { getDb } = require('../db/database');

class UnitRepository {
  getAll({ search } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (search) {
      conds.push('LOWER(name) LIKE ?');
      params.push(`%${String(search).toLowerCase()}%`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT * FROM units
      ${where}
      ORDER BY name ASC
    `).all(...params);
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM units WHERE id = ?').get(id);
  }

  getByName(name) {
    const db = getDb();
    return db.prepare('SELECT * FROM units WHERE name = ? COLLATE NOCASE').get(name);
  }

  create({ name }) {
    const db = getDb();
    const info = db.prepare('INSERT INTO units (name) VALUES (?)').run(name);
    return this.getById(info.lastInsertRowid);
  }

  update(id, { name }) {
    const db = getDb();
    db.prepare(`
      UPDATE units
      SET name = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name, id);
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM units WHERE id = ?').run(id);
  }

  countItems(name) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS n FROM items WHERE unit = ? COLLATE NOCASE').get(name);
    return row.n;
  }
}

module.exports = new UnitRepository();
