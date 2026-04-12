const transactionCategoryRepository = require('../repositories/transactionCategoryRepository');
const { AppError } = require('../middleware/errorHandler');

class TransactionCategoryService {
  getAll() {
    return transactionCategoryRepository.getAll();
  }

  getById(id) {
    const cat = transactionCategoryRepository.getById(id);
    if (!cat) throw new AppError('Transaction category not found', 404);
    return cat;
  }

  create(name) {
    if (!name || !name.trim()) throw new AppError('Category name is required', 400);
    return transactionCategoryRepository.create(name);
  }

  update(id, name) {
    if (!name || !name.trim()) throw new AppError('Category name is required', 400);
    const existing = transactionCategoryRepository.getById(id);
    if (!existing) throw new AppError('Transaction category not found', 404);
    return transactionCategoryRepository.update(id, name);
  }

  delete(id) {
    const existing = transactionCategoryRepository.getById(id);
    if (!existing) throw new AppError('Transaction category not found', 404);
    return transactionCategoryRepository.delete(id);
  }
}

module.exports = new TransactionCategoryService();
