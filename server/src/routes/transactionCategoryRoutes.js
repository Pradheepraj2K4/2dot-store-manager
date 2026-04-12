const express = require('express');
const router = express.Router();
const transactionCategoryController = require('../controllers/transactionCategoryController');

router.get('/',       (req, res, next) => transactionCategoryController.getAll(req, res, next));
router.post('/',      (req, res, next) => transactionCategoryController.create(req, res, next));
router.put('/:id',    (req, res, next) => transactionCategoryController.update(req, res, next));
router.delete('/:id', (req, res, next) => transactionCategoryController.delete(req, res, next));

module.exports = router;
