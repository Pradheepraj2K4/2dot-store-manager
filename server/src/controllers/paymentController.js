// TransactionController — handles payments AND receipts (formerly PaymentController)
const transactionService = require('../services/paymentService');

class TransactionController {
  getAll(req, res, next) {
    try {
      const { ledgerId, entryType, fromDate, toDate, ledgerTypeId, behaviour, interestSchemeId } = req.query;
      const transactions = transactionService.getTransactions({
        ledgerId: ledgerId ? parseInt(ledgerId) : undefined,
        entryType: entryType || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        ledgerTypeId: ledgerTypeId ? parseInt(ledgerTypeId) : undefined,
        behaviour: behaviour || undefined,
        interestSchemeId: interestSchemeId ? parseInt(interestSchemeId) : undefined,
      });
      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const tx = transactionService.getTransactionById(parseInt(req.params.id));
      res.json({ success: true, data: tx });
    } catch (err) {
      next(err);
    }
  }

  getByLedger(req, res, next) {
    try {
      const txs = transactionService.getTransactionsByLedger(parseInt(req.params.ledgerId));
      res.json({ success: true, data: txs });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const tx = transactionService.createTransaction(req.body);
      res.status(201).json({ success: true, data: tx });
    } catch (err) {
      next(err);
    }
  }

  getSummary(req, res, next) {
    try {
      const summary = transactionService.getTransactionSummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  getRecent(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const txs = transactionService.getRecentTransactions(limit);
      res.json({ success: true, data: txs });
    } catch (err) {
      next(err);
    }
  }

  getNextRunningNumber(req, res, next) {
    try {
      const entryType = req.query.entryType || 'payment';
      const runningNumber = transactionService.getNextRunningNumber(entryType);
      res.json({ success: true, data: { runningNumber } });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      transactionService.deleteTransaction(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TransactionController();
