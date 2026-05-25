const express = require('express');
const router = express.Router();
const salesReturnController = require('../controllers/salesReturnController');

router.get('/next-number',      (req, res, next) => salesReturnController.getNextNumber(req, res, next));
router.get('/ledger/:ledgerId', (req, res, next) => salesReturnController.getByLedger(req, res, next));
router.get('/',                 (req, res, next) => salesReturnController.getAll(req, res, next));
router.get('/:id',              (req, res, next) => salesReturnController.getById(req, res, next));
router.post('/',                (req, res, next) => salesReturnController.create(req, res, next));
router.put('/:id',              (req, res, next) => salesReturnController.update(req, res, next));
router.delete('/:id',           (req, res, next) => salesReturnController.delete(req, res, next));

module.exports = router;
