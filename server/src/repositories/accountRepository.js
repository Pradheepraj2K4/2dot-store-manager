const { getDb } = require('../db/database');

class LedgerTypeRepository {
  findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM ledger_types ORDER BY is_system DESC, name ASC').all();
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM ledger_types WHERE id = ?').get(id);
  }

  findByName(name) {
    const db = getDb();
    return db.prepare('SELECT * FROM ledger_types WHERE LOWER(name) = LOWER(?)').get(name);
  }

  create({ name, behaviour }) {
    const db = getDb();
    const result = db.prepare('INSERT INTO ledger_types (name, behaviour, is_system) VALUES (?, ?, 0)').run(name, behaviour);
    return this.findById(result.lastInsertRowid);
  }

  update(id, { name, behaviour }) {
    const db = getDb();
    db.prepare('UPDATE ledger_types SET name = ?, behaviour = ? WHERE id = ? AND is_system = 0').run(name, behaviour, id);
    return this.findById(id);
  }

  countLedgers(id) {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) AS count FROM ledgers WHERE ledger_type_id = ?').get(id).count;
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM ledger_types WHERE id = ? AND is_system = 0').run(id);
  }
}

module.exports = new LedgerTypeRepository();
