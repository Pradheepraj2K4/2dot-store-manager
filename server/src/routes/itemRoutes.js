const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

router.get('/brands',     (req, res, next) => itemController.getBrands(req, res, next));
router.get('/categories', (req, res, next) => itemController.getCategories(req, res, next));
router.get('/stock-report', (req, res, next) => itemController.getStockReport(req, res, next));
router.get('/',           (req, res, next) => itemController.getAll(req, res, next));
router.get('/:id',        (req, res, next) => itemController.getById(req, res, next));
router.post('/',          (req, res, next) => itemController.create(req, res, next));
router.put('/:id',        (req, res, next) => itemController.update(req, res, next));
router.delete('/:id',     (req, res, next) => itemController.delete(req, res, next));

module.exports = router;
