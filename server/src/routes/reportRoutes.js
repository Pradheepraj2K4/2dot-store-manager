const express = require('express');
const router = express.Router();
const txnController = require('../controllers/transactionController');

// Statement of Account
router.get('/statement/:partyId', (req, res, next) => txnController.getStatement(req, res, next));

module.exports = router;
