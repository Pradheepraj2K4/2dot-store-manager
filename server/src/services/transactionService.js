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

    // Generate receipt number — separate sequences: REC-XXXXXX (credit) / PAY-XXXXXX (debit)
    const receiptNumber = this._generateReceiptNumber(type);

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

  updateTransaction(id, { date, type, amount, reference, notes }) {
    const txn = transactionRepository.findById(id);
    if (!txn) throw new AppError('Transaction not found', 404);

    if (!type || !['credit', 'debit'].includes(type)) {
      throw new AppError('Invalid transaction type. Must be "credit" or "debit".', 400);
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Amount must be a positive number.', 400);
    }

    transactionRepository.update(id, {
      date: date || txn.date,
      type,
      amount: parsedAmount,
      reference: reference ?? txn.reference,
      notes: notes ?? txn.notes,
    });

    this._recalculatePartyBalances(txn.party_id);
    return transactionRepository.findById(id);
  }

  deleteTransaction(id) {
    const txn = transactionRepository.findById(id);
    if (!txn) throw new AppError('Transaction not found', 404);
    const partyId = txn.party_id;
    transactionRepository.delete(id);
    this._recalculatePartyBalances(partyId);
  }

  // Recalculate balance_after for every transaction of a party in chronological order
  _recalculatePartyBalances(partyId) {
    const party = partyRepository.findById(partyId);
    if (!party) return;

    const txns = transactionRepository.findByPartyId(partyId); // ordered date ASC, id ASC
    let runningBalance = party.opening_balance;

    for (const t of txns) {
      if (party.type === 'customer') {
        // Customer owes us; credit (payment received) reduces balance, debit (sale) increases
        runningBalance = t.type === 'credit'
          ? runningBalance - t.amount
          : runningBalance + t.amount;
      } else {
        // Supplier we owe; credit (purchase) increases balance, debit (payment) reduces
        runningBalance = t.type === 'credit'
          ? runningBalance + t.amount
          : runningBalance - t.amount;
      }
      transactionRepository.updateBalanceAfter(t.id, runningBalance);
    }
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

  getNextReceiptNumber(type = 'credit') {
    return this._generateReceiptNumber(type);
  }

  _generateReceiptNumber(type = 'credit') {
    const isDebit = type === 'debit';
    const prefix = isDebit ? 'PAY' : 'REC';
    const regex  = isDebit ? /PAY-(\d+)/ : /REC-(\d+)/;

    const lastReceipt = transactionRepository.getLastReceiptNumber(type);
    let nextNum = 1;
    if (lastReceipt) {
      const match = lastReceipt.match(regex);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}-${String(nextNum).padStart(6, '0')}`;
  }
}

module.exports = new TransactionService();
