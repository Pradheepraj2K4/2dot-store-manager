const { getDb } = require('../db/database');

class ExpenseRepository {
  // ── Categories ────────────────────────────────────────────────────────

  getAllCategories() {
    const db = getDb();
    return db.prepare('SELECT * FROM expense_categories ORDER BY name ASC').all();
  }

  getCategoryById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id);
  }

  createCategory(name) {
    const db = getDb();
    const info = db.prepare('INSERT INTO expense_categories (name) VALUES (?)').run(name.trim());
    return this.getCategoryById(info.lastInsertRowid);
  }

  updateCategory(id, name) {
    const db = getDb();
    db.prepare('UPDATE expense_categories SET name = ? WHERE id = ?').run(name.trim(), id);
    return this.getCategoryById(id);
  }

  deleteCategory(id) {
    const db = getDb();
    // Nullify expenses using this category before deleting
    db.prepare('UPDATE expenses SET expense_category_id = NULL WHERE expense_category_id = ?').run(id);
    return db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id);
  }

  // ── Expenses ──────────────────────────────────────────────────────────

  getAll({ fromDate, toDate, categoryId, expenseName } = {}) {
    const db = getDb();
    const conditions = [];
    const params = [];

    if (fromDate) { conditions.push('e.date >= ?'); params.push(fromDate); }
    if (toDate)   { conditions.push('e.date <= ?'); params.push(toDate); }
    if (categoryId) { conditions.push('e.expense_category_id = ?'); params.push(categoryId); }
    if (expenseName) { conditions.push('LOWER(e.expense_name) LIKE ?'); params.push(`%${expenseName.toLowerCase()}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.prepare(`
      SELECT e.*, c.name AS category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON c.id = e.expense_category_id
      ${where}
      ORDER BY e.date DESC, e.id DESC
    `).all(...params);
  }

  getById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT e.*, c.name AS category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON c.id = e.expense_category_id
      WHERE e.id = ?
    `).get(id);
  }

  create({ expense_name, expense_category_id, amount, date, notes }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO expenses (expense_name, expense_category_id, amount, date, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      expense_name.trim(),
      expense_category_id || null,
      amount,
      date,
      (notes || '').trim()
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, { expense_name, expense_category_id, amount, date, notes }) {
    const db = getDb();
    db.prepare(`
      UPDATE expenses
      SET expense_name = ?, expense_category_id = ?, amount = ?, date = ?, notes = ?
      WHERE id = ?
    `).run(
      expense_name.trim(),
      expense_category_id || null,
      amount,
      date,
      (notes || '').trim(),
      id
    );
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  }

  // Auto-suggest expense names based on previous entries
  getSuggestions(prefix) {
    const db = getDb();
    return db.prepare(`
      SELECT DISTINCT expense_name
      FROM expenses
      WHERE LOWER(expense_name) LIKE ?
      ORDER BY expense_name ASC
      LIMIT 20
    `).all(`%${prefix.toLowerCase()}%`).map((r) => r.expense_name);
  }

  // Summary for dashboard / reports
  getSummary({ fromDate, toDate } = {}) {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (fromDate) { conditions.push('e.date >= ?'); params.push(fromDate); }
    if (toDate)   { conditions.push('e.date <= ?'); params.push(toDate); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses e ${where}`).get(...params);
    const byCategory = db.prepare(`
      SELECT c.name AS category_name, COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS count
      FROM expenses e
      LEFT JOIN expense_categories c ON c.id = e.expense_category_id
      ${where}
      GROUP BY e.expense_category_id
      ORDER BY total DESC
    `).all(...params);

    return { total: total.total, byCategory };
  }

  getTodayTotal() {
    const db = getDb();
    // Use SQLite's localtime to match how dates are stored
    const row = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date = date('now', 'localtime')").get();
    return row.total;
  }

  getMonthTotal() {
    const db = getDb();
    const row = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')").get();
    return row.total;
  }
}

module.exports = new ExpenseRepository();
