const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/paymentController');

// Transaction reports with filters (entryType=payment or entryType=receipt)
router.get('/transactions', (req, res, next) => transactionController.getAll(req, res, next));
router.get('/transactions/summary', (req, res, next) => transactionController.getSummary(req, res, next));

module.exports = router;
