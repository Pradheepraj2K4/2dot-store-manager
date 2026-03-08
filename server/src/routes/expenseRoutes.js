const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');

// Categories
router.get('/categories',          (req, res, next) => expenseController.getCategories(req, res, next));
router.post('/categories',         (req, res, next) => expenseController.createCategory(req, res, next));
router.put('/categories/:id',      (req, res, next) => expenseController.updateCategory(req, res, next));
router.delete('/categories/:id',   (req, res, next) => expenseController.deleteCategory(req, res, next));

// Expenses
router.get('/suggestions',         (req, res, next) => expenseController.getSuggestions(req, res, next));
router.get('/summary',             (req, res, next) => expenseController.getSummary(req, res, next));
router.get('/',                    (req, res, next) => expenseController.getAll(req, res, next));
router.get('/:id',                 (req, res, next) => expenseController.getById(req, res, next));
router.post('/',                   (req, res, next) => expenseController.create(req, res, next));
router.put('/:id',                 (req, res, next) => expenseController.update(req, res, next));
router.delete('/:id',              (req, res, next) => expenseController.delete(req, res, next));

module.exports = router;
