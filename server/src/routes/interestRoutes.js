const express = require('express');
const router = express.Router();
const interestController = require('../controllers/interestController');

router.get('/enabled',                     (req, res, next) => interestController.isEnabled(req, res, next));
router.get('/ledger/:ledgerId',            (req, res, next) => interestController.getByLedger(req, res, next));
router.get('/ledger/:ledgerId/pending',    (req, res, next) => interestController.getPendingByLedger(req, res, next));
router.get('/ledger/:ledgerId/total',      (req, res, next) => interestController.getTotalPending(req, res, next));
router.get('/',                            (req, res, next) => interestController.getAll(req, res, next));
router.post('/generate',                   (req, res, next) => interestController.generate(req, res, next));

module.exports = router;
