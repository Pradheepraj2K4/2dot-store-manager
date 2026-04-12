const { getDb } = require('../db/database');

class TransactionCategoryRepository {
  getAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM transaction_categories ORDER BY name ASC').all();
  }

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM transaction_categories WHERE id = ?').get(id);
  }

  create(name) {
    const db = getDb();
    const info = db.prepare('INSERT INTO transaction_categories (name) VALUES (?)').run(name.trim());
    return this.getById(info.lastInsertRowid);
  }

  update(id, name) {
    const db = getDb();
    db.prepare('UPDATE transaction_categories SET name = ? WHERE id = ?').run(name.trim(), id);
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    // Nullify transactions using this category before deleting
    db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(id);
    return db.prepare('DELETE FROM transaction_categories WHERE id = ?').run(id);
  }
}

module.exports = new TransactionCategoryRepository();
