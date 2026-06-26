const { getDb } = require('../db/database');

class CustomerRepository {
  getAll({ search, status } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (status) { conds.push('status = ?'); params.push(status); }
    if (search) {
      const like = `%${String(search).toLowerCase()}%`;
      conds.push('(LOWER(name) LIKE ? OR mobile LIKE ? OR LOWER(place) LIKE ?)');
      params.push(like, `%${String(search)}%`, like);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT * FROM customers
      ${where}
      ORDER BY name ASC
    `).all(...params);
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  }

  findByMobile(mobile) {
    const db = getDb();
    const m = String(mobile || '').trim();
    if (!m) return null;
    return db.prepare('SELECT * FROM customers WHERE mobile = ?').get(m);
  }

  create({ name, mobile, place, address, email, notes }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO customers (name, mobile, place, address, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name,
      mobile || '',
      place || '',
      address || '',
      email || '',
      notes || ''
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, { name, mobile, place, address, email, notes, status }) {
    const db = getDb();
    db.prepare(`
      UPDATE customers
      SET name = ?, mobile = ?, place = ?, address = ?, email = ?, notes = ?, status = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name,
      mobile || '',
      place || '',
      address || '',
      email || '',
      notes || '',
      status || 'active',
      id
    );
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  }

  countSales(id) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS n FROM sales WHERE customer_id = ?').get(id);
    return row.n;
  }
}

module.exports = new CustomerRepository();
