const express = require('express');
const router = express.Router();
const txnController = require('../controllers/transactionController');

router.get('/', (req, res, next) => txnController.getAll(req, res, next));
router.get('/outstanding', (req, res, next) => txnController.getOutstanding(req, res, next));
router.get('/next-receipt', (req, res, next) => txnController.getNextReceiptNumber(req, res, next));
router.get('/party/:partyId', (req, res, next) => txnController.getByParty(req, res, next));
router.get('/party/:partyId/balance', (req, res, next) => txnController.getPartyBalance(req, res, next));
router.get('/party/:partyId/statement', (req, res, next) => txnController.getStatement(req, res, next));
router.get('/:id', (req, res, next) => txnController.getById(req, res, next));
router.post('/', (req, res, next) => txnController.recordPayment(req, res, next));
router.put('/:id', (req, res, next) => txnController.updateTransaction(req, res, next));
router.delete('/:id', (req, res, next) => txnController.deleteTransaction(req, res, next));

module.exports = router;
