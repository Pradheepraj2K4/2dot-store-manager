const transactionRepository = require('../repositories/transactionRepository');
const partyRepository = require('../repositories/partyRepository');
const { AppError } = require('../middleware/errorHandler');

class TransactionService {
  getAllTransactions(filters = {}) {
    return transactionRepository.findAll(filters);
  }

  getTransactionById(id) {
    const txn = transactionRepository.findById(id);
    if (!txn) {
      throw new AppError('Transaction not found', 404);
    }
    return txn;
  }

  getTransactionsByParty(partyId) {
    const party = partyRepository.findById(partyId);
    if (!party) {
      throw new AppError('Party not found', 404);
    }
    const transactions = transactionRepository.findByPartyId(partyId);
    const balance = transactionRepository.getPartyBalance(partyId);
    return { party, transactions, balance };
  }

  recordPayment({ party_id, date, type, amount, reference, notes }) {
    // Validate party exists
    const party = partyRepository.findById(party_id);
    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Validate type
    if (!type || !['credit', 'debit'].includes(type)) {
      throw new AppError('Invalid transaction type. Must be "credit" or "debit".', 400);
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Amount must be a positive number.', 400);
    }

    // Calculate current balance
    const currentBalanceData = transactionRepository.getPartyBalance(party_id);
    let balanceAfter = currentBalanceData.current_balance;
    
    // Balance calculation depends on party type:
    // CUSTOMER (they owe us): credit reduces (-), debit increases (+)
    // SUPPLIER (we owe them): credit increases (+), debit reduces (-)
    if (party.type === 'customer') {
      if (type === 'credit') {
        balanceAfter -= parsedAmount;
      } else {
        balanceAfter += parsedAmount;
      }
    } else {
      if (type === 'credit') {
        balanceAfter += parsedAmount;
      } else {
        balanceAfter -= parsedAmount;
      }
    }

    // Generate receipt number
    const receiptNumber = this._generateReceiptNumber();

    // Use provided date or today
    const txnDate = date || new Date().toISOString().split('T')[0];

    const transaction = transactionRepository.create({
      party_id,
      date: txnDate,
      type,
      amount: parsedAmount,
      reference: reference || '',
      notes: notes || '',
      receipt_number: receiptNumber,
      balance_after: balanceAfter,
    });

    return transaction;
  }

  getOutstandingBalances() {
    return transactionRepository.getAllBalances();
  }

  getPartyBalance(partyId) {
    const party = partyRepository.findById(partyId);
    if (!party) {
      throw new AppError('Party not found', 404);
    }
    return transactionRepository.getPartyBalance(partyId);
  }

  getRecentTransactions(limit = 10) {
    return transactionRepository.getRecentTransactions(limit);
  }

  getSummary() {
    return transactionRepository.getSummary();
  }

  getStatementOfAccount(partyId, startDate, endDate) {
    const party = partyRepository.findById(partyId);
    if (!party) {
      throw new AppError('Party not found', 404);
    }

    const transactions = transactionRepository.findAll({
      partyId,
      startDate,
      endDate,
    });

    const balance = transactionRepository.getPartyBalance(partyId);

    return {
      party,
      transactions,
      balance,
      period: { startDate, endDate },
    };
  }

  getNextReceiptNumber() {
    return this._generateReceiptNumber();
  }

  _generateReceiptNumber() {
    const lastReceipt = transactionRepository.getLastReceiptNumber();
    let nextNum = 1;
    if (lastReceipt) {
      const match = lastReceipt.match(/REC-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `REC-${String(nextNum).padStart(6, '0')}`;
  }
}

module.exports = new TransactionService();
