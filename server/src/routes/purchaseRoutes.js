const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.get('/next-number',      (req, res, next) => purchaseController.getNextNumber(req, res, next));
router.get('/ledger/:ledgerId', (req, res, next) => purchaseController.getByLedger(req, res, next));
router.get('/',                 (req, res, next) => purchaseController.getAll(req, res, next));
router.get('/:id',              (req, res, next) => purchaseController.getById(req, res, next));
router.post('/',                (req, res, next) => purchaseController.create(req, res, next));
router.put('/:id',              (req, res, next) => purchaseController.update(req, res, next));
router.delete('/:id',           (req, res, next) => purchaseController.delete(req, res, next));

module.exports = router;
