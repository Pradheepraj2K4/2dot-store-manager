const { getDb } = require('../db/database');

class InterestSchemeRepository {
  findAll() {
    return getDb()
      .prepare('SELECT * FROM interest_schemes ORDER BY is_system DESC, name ASC')
      .all();
  }

  findById(id) {
    return getDb()
      .prepare('SELECT * FROM interest_schemes WHERE id = ?')
      .get(id);
  }

  findByName(name) {
    return getDb()
      .prepare('SELECT * FROM interest_schemes WHERE LOWER(name) = LOWER(?)')
      .get(name);
  }

  create({ name, nature }) {
    const db = getDb();
    const result = db
      .prepare('INSERT INTO interest_schemes (name, nature, is_system) VALUES (?, ?, 0)')
      .run(name, nature);
    return this.findById(result.lastInsertRowid);
  }

  updateName(id, name) {
    getDb().prepare('UPDATE interest_schemes SET name = ? WHERE id = ?').run(name, id);
    return this.findById(id);
  }

  update(id, { name, nature }) {
    const db = getDb();
    db.prepare(
      'UPDATE interest_schemes SET name = ?, nature = ? WHERE id = ? AND is_system = 0'
    ).run(name, nature, id);
    return this.findById(id);
  }

  countLedgers(id) {
    return getDb()
      .prepare('SELECT COUNT(*) AS count FROM ledgers WHERE interest_scheme_id = ?')
      .get(id).count;
  }

  delete(id) {
    return getDb()
      .prepare('DELETE FROM interest_schemes WHERE id = ? AND is_system = 0')
      .run(id);
  }
}

module.exports = new InterestSchemeRepository();
