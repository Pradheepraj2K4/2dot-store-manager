// Transaction routes (formerly payment routes)
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/paymentController');

router.get('/summary',               (req, res, next) => transactionController.getSummary(req, res, next));
router.get('/recent',                (req, res, next) => transactionController.getRecent(req, res, next));
router.get('/next-number',           (req, res, next) => transactionController.getNextRunningNumber(req, res, next));
router.get('/ledger/:ledgerId',      (req, res, next) => transactionController.getByLedger(req, res, next));
router.get('/:id',                   (req, res, next) => transactionController.getById(req, res, next));
router.get('/',                      (req, res, next) => transactionController.getAll(req, res, next));
router.post('/',                     (req, res, next) => transactionController.create(req, res, next));
router.delete('/:id',                (req, res, next) => transactionController.delete(req, res, next));

module.exports = router;
