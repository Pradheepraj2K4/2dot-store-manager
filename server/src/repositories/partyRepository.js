const { getDb } = require('../db/database');

class PartyRepository {
  findAll(type = null) {
    const db = getDb();
    if (type) {
      return db.prepare('SELECT * FROM parties WHERE type = ? ORDER BY name ASC').all(type);
    }
    return db.prepare('SELECT * FROM parties ORDER BY name ASC').all();
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM parties WHERE id = ?').get(id);
  }

  create({ type, name, address, phone, place, opening_balance, gst_no, state_code, igst_status }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO parties (type, name, address, phone, place, opening_balance, gst_no, state_code, igst_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      type, name, address || '', phone || '', place || '', opening_balance || 0,
      gst_no || '', state_code || '', igst_status || 'NO'
    );
    return this.findById(result.lastInsertRowid);
  }

  update(id, { name, address, phone, place, type, gst_no, state_code, igst_status }) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE parties
      SET name = ?, address = ?, phone = ?, place = ?, type = ?,
          gst_no = ?, state_code = ?, igst_status = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    stmt.run(name, address || '', phone || '', place || '', type,
      gst_no || '', state_code || '', igst_status || 'NO', id);
    return this.findById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM parties WHERE id = ?').run(id);
  }

  search(query) {
    const db = getDb();
    const like = `%${query}%`;
    return db.prepare(`
      SELECT * FROM parties
      WHERE name LIKE ? OR phone LIKE ? OR place LIKE ?
      ORDER BY name ASC
    `).all(like, like, like);
  }

  count() {
    const db = getDb();
    return db.prepare('SELECT type, COUNT(*) as count FROM parties GROUP BY type').all();
  }
}

module.exports = new PartyRepository();
