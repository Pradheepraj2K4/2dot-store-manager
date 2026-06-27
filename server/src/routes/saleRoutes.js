const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

router.get('/next-number',         (req, res, next) => saleController.getNextNumber(req, res, next));
router.get('/bill-profit',         (req, res, next) => saleController.getBillProfit(req, res, next));
router.get('/ledger/:ledgerId',    (req, res, next) => saleController.getByLedger(req, res, next));
router.get('/',                    (req, res, next) => saleController.getAll(req, res, next));
router.get('/:id',                 (req, res, next) => saleController.getById(req, res, next));
router.post('/',                   (req, res, next) => saleController.create(req, res, next));
router.put('/:id',                 (req, res, next) => saleController.update(req, res, next));
router.delete('/:id',              (req, res, next) => saleController.delete(req, res, next));

module.exports = router;
