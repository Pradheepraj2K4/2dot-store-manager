// TransactionService — handles payments AND receipts (formerly PaymentService)
const transactionRepository = require('../repositories/paymentRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const ledgerTypeRepository = require('../repositories/accountRepository');
const interestRepository = require('../repositories/interestRepository');
const { AppError } = require('../middleware/errorHandler');
const { getDb } = require('../db/database');

class TransactionService {
  /**
   * Create a transaction (payment or receipt).
   * Balance logic:
   *   customer behaviour: payment ADDS to balance, receipt SUBTRACTS
   *   supplier behaviour: payment SUBTRACTS from balance, receipt ADDS
   */
  createTransaction({ ledger_id, entry_type, amount, date, reference, notes, interest_entry_id }) {
    const db = getDb();
    const ledger = ledgerRepository.findById(ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);
    if (ledger.status === 'closed') throw new AppError('Cannot transact on a closed ledger', 400);
    if (!['payment', 'receipt'].includes(entry_type)) throw new AppError('entry_type must be "payment" or "receipt"', 400);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Amount must be a positive number', 400);

    const txDate = date || new Date().toISOString().split('T')[0];
    const runningNumber = transactionRepository.getNextRunningNumber(entry_type);

    const behaviour = ledger.behaviour || 'customer';

    // Pre-check: ensure the entry won't drive balance negative
    let projectedBalance = ledger.current_balance;
    if (behaviour === 'customer') {
      projectedBalance = entry_type === 'payment' ? projectedBalance + amt : projectedBalance - amt;
    } else {
      projectedBalance = entry_type === 'payment' ? projectedBalance - amt : projectedBalance + amt;
    }

    const run = db.transaction(() => {
      const tx = transactionRepository.create({
        ledger_id,
        entry_type,
        amount: amt,
        date: txDate,
        reference: reference || '',
        notes: notes || '',
        running_number: runningNumber,
        interest_entry_id: interest_entry_id || null,
      });

      // Update ledger balance
      let newBalance = ledger.current_balance;
      if (behaviour === 'customer') {
        newBalance = entry_type === 'payment' ? newBalance + amt : newBalance - amt;
      } else {
        newBalance = entry_type === 'payment' ? newBalance - amt : newBalance + amt;
      }
      ledgerRepository.updateBalance(ledger_id, newBalance);

      // If paying interest, mark it paid
      if (interest_entry_id) {
        interestRepository.markPaid(interest_entry_id, txDate);
      }

      return tx;
    });

    return run();
  }

  getTransactions(filters = {}) {
    return transactionRepository.findAll(filters);
  }

  getTransactionById(id) {
    const tx = transactionRepository.findById(id);
    if (!tx) throw new AppError('Transaction not found', 404);
    return tx;
  }

  getTransactionsByLedger(ledgerId) {
    return transactionRepository.findByLedgerId(ledgerId);
  }

  getTransactionSummary() {
    return transactionRepository.getSummary();
  }

  getRecentTransactions(limit = 10) {
    return transactionRepository.getRecentTransactions(limit);
  }

  getNextRunningNumber(entryType) {
    return transactionRepository.getNextRunningNumber(entryType);
  }

  deleteTransaction(id) {
    const db = getDb();
    const tx = transactionRepository.findById(id);
    if (!tx) throw new AppError('Transaction not found', 404);

    const ledger = ledgerRepository.findById(tx.ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);

    const run = db.transaction(() => {
      // Reverse the balance effect of this transaction
      const amt = parseFloat(tx.amount);
      const behaviour = ledger.behaviour || 'customer';
      let newBalance = ledger.current_balance;
      if (behaviour === 'customer') {
        newBalance = tx.entry_type === 'payment' ? newBalance - amt : newBalance + amt;
      } else {
        newBalance = tx.entry_type === 'payment' ? newBalance + amt : newBalance - amt;
      }
      ledgerRepository.updateBalance(tx.ledger_id, newBalance);
      transactionRepository.deleteById(id);
    });

    run();
  }
}

module.exports = new TransactionService();
