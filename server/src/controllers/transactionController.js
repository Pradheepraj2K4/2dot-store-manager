const transactionService = require('../services/transactionService');

class TransactionController {
  getAll(req, res, next) {
    try {
      const { partyId, startDate, endDate, type, limit, offset } = req.query;
      const transactions = transactionService.getAllTransactions({
        partyId: partyId ? parseInt(partyId) : null,
        startDate,
        endDate,
        type,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : null,
      });
      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const transaction = transactionService.getTransactionById(parseInt(req.params.id));
      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }

  getByParty(req, res, next) {
    try {
      const result = transactionService.getTransactionsByParty(parseInt(req.params.partyId));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  recordPayment(req, res, next) {
    try {
      const transaction = transactionService.recordPayment(req.body);
      res.status(201).json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }

  getOutstanding(req, res, next) {
    try {
      const balances = transactionService.getOutstandingBalances();
      res.json({ success: true, data: balances });
    } catch (err) {
      next(err);
    }
  }

  getPartyBalance(req, res, next) {
    try {
      const balance = transactionService.getPartyBalance(parseInt(req.params.partyId));
      res.json({ success: true, data: balance });
    } catch (err) {
      next(err);
    }
  }

  getStatement(req, res, next) {
    try {
      const { partyId } = req.params;
      const { startDate, endDate } = req.query;
      const statement = transactionService.getStatementOfAccount(
        parseInt(partyId),
        startDate,
        endDate
      );
      res.json({ success: true, data: statement });
    } catch (err) {
      next(err);
    }
  }

  getNextReceiptNumber(req, res, next) {
    try {
      const type = req.query.type || 'credit';
      const receiptNumber = transactionService.getNextReceiptNumber(type);
      res.json({ success: true, data: { receipt_number: receiptNumber } });
    } catch (err) {
      next(err);
    }
  }

  updateTransaction(req, res, next) {
    try {
      const transaction = transactionService.updateTransaction(
        parseInt(req.params.id),
        req.body
      );
      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }

  deleteTransaction(req, res, next) {
    try {
      transactionService.deleteTransaction(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TransactionController();
