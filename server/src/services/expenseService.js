const expenseRepository = require('../repositories/expenseRepository');

class ExpenseService {
  // ── Categories ────────────────────────────────────────────────────────

  getAllCategories() {
    return expenseRepository.getAllCategories();
  }

  createCategory(name) {
    if (!name || !name.trim()) throw new Error('Category name is required');
    return expenseRepository.createCategory(name);
  }

  updateCategory(id, name) {
    if (!name || !name.trim()) throw new Error('Category name is required');
    return expenseRepository.updateCategory(id, name);
  }

  deleteCategory(id) {
    return expenseRepository.deleteCategory(id);
  }

  // ── Expenses ──────────────────────────────────────────────────────────

  getAll(filters = {}) {
    return expenseRepository.getAll(filters);
  }

  getById(id) {
    const expense = expenseRepository.getById(id);
    if (!expense) throw new Error('Expense not found');
    return expense;
  }

  create(data) {
    const { expense_name, amount, date } = data;
    if (!expense_name || !expense_name.trim()) throw new Error('Expense name is required');
    if (!amount || Number(amount) <= 0) throw new Error('Amount must be greater than zero');
    if (!date) throw new Error('Date is required');
    return expenseRepository.create({ ...data, amount: parseFloat(amount) });
  }

  update(id, data) {
    const { expense_name, amount, date } = data;
    if (!expense_name || !expense_name.trim()) throw new Error('Expense name is required');
    if (!amount || Number(amount) <= 0) throw new Error('Amount must be greater than zero');
    if (!date) throw new Error('Date is required');
    return expenseRepository.update(id, { ...data, amount: parseFloat(amount) });
  }

  delete(id) {
    return expenseRepository.delete(id);
  }

  getSuggestions(prefix) {
    if (!prefix) return [];
    return expenseRepository.getSuggestions(prefix);
  }

  getSummary(filters = {}) {
    return expenseRepository.getSummary(filters);
  }

  getTodayTotal() {
    return expenseRepository.getTodayTotal();
  }

  getMonthTotal() {
    return expenseRepository.getMonthTotal();
  }
}

module.exports = new ExpenseService();
