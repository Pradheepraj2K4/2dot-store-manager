const express = require('express');
const router = express.Router();
const purchaseReturnController = require('../controllers/purchaseReturnController');

router.get('/next-number',      (req, res, next) => purchaseReturnController.getNextNumber(req, res, next));
router.get('/ledger/:ledgerId', (req, res, next) => purchaseReturnController.getByLedger(req, res, next));
router.get('/',                 (req, res, next) => purchaseReturnController.getAll(req, res, next));
router.get('/:id',              (req, res, next) => purchaseReturnController.getById(req, res, next));
router.post('/',                (req, res, next) => purchaseReturnController.create(req, res, next));
router.put('/:id',              (req, res, next) => purchaseReturnController.update(req, res, next));
router.delete('/:id',           (req, res, next) => purchaseReturnController.delete(req, res, next));

module.exports = router;
