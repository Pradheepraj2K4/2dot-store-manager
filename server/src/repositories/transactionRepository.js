const { getDb } = require('../db/database');

class TransactionRepository {
  findAll({ partyId, startDate, endDate, type, limit, offset } = {}) {
    const db = getDb();
    let query = `
      SELECT t.*, p.name as party_name, p.type as party_type
      FROM transactions t
      JOIN parties p ON t.party_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (partyId) {
      query += ' AND t.party_id = ?';
      params.push(partyId);
    }
    if (startDate) {
      query += ' AND t.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND t.date <= ?';
      params.push(endDate);
    }
    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }

    query += ' ORDER BY t.date DESC, t.id DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }
    }

    return db.prepare(query).all(...params);
  }

  findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, p.name as party_name, p.type as party_type
      FROM transactions t
      JOIN parties p ON t.party_id = p.id
      WHERE t.id = ?
    `).get(id);
  }

  findByPartyId(partyId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM transactions
      WHERE party_id = ?
      ORDER BY date ASC, id ASC
    `).all(partyId);
  }

  findByReceiptNumber(receiptNumber) {
    const db = getDb();
    return db.prepare('SELECT * FROM transactions WHERE receipt_number = ?').get(receiptNumber);
  }

  update(id, { date, type, amount, reference, notes }) {
    const db = getDb();
    db.prepare(`
      UPDATE transactions
      SET date = ?, type = ?, amount = ?, reference = ?, notes = ?
      WHERE id = ?
    `).run(date, type, amount, reference ?? '', notes ?? '', id);
    return this.findById(id);
  }

  updateBalanceAfter(id, balance_after) {
    const db = getDb();
    db.prepare('UPDATE transactions SET balance_after = ? WHERE id = ?').run(balance_after, id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  }

  create({ party_id, date, type, amount, reference, notes, receipt_number, balance_after, payment_target }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO transactions (party_id, date, type, amount, reference, notes, receipt_number, balance_after, payment_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(party_id, date, type, amount, reference || '', notes || '', receipt_number, balance_after, payment_target || 'principal');
    return this.findById(result.lastInsertRowid);
  }

  getPartyBalance(partyId) {
    const db = getDb();
    const party = db.prepare('SELECT opening_balance, type FROM parties WHERE id = ?').get(partyId);
    if (!party) return null;

    // Only count principal-targeted transactions for the balance
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credit,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debit
      FROM transactions
      WHERE party_id = ? AND payment_target = 'principal'
    `).get(partyId);

    // Interest-targeted payments (tracked separately)
    const interestTotals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as interest_credit,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as interest_debit
      FROM transactions
      WHERE party_id = ? AND payment_target = 'interest'
    `).get(partyId);

    // For CUSTOMER: opening - credit + debit (they owe us)
    // For SUPPLIER: opening + credit - debit (we owe them)
    const current_balance = party.type === 'customer'
      ? party.opening_balance - totals.total_credit + totals.total_debit
      : party.opening_balance + totals.total_credit - totals.total_debit;

    // Pending interest from the interest_entries table
    const interestRow = db.prepare(`
      SELECT COALESCE(SUM(interest_amount - adjustment), 0) as pending_interest
      FROM interest_entries
      WHERE party_id = ? AND status = 'pending'
    `).get(partyId);

    const pending_interest = interestRow ? interestRow.pending_interest : 0;
    const outstanding = current_balance + pending_interest;

    return {
      opening_balance: party.opening_balance,
      total_credit: totals.total_credit,
      total_debit: totals.total_debit,
      current_balance,
      interest_credit: interestTotals.interest_credit,
      interest_debit: interestTotals.interest_debit,
      pending_interest,
      outstanding,
    };
  }

  getAllBalances() {
    const db = getDb();
    return db.prepare(`
      SELECT
        p.id,
        p.name,
        p.type,
        p.phone,
        p.place,
        p.opening_balance,
        p.interest_rate,
        p.interest_scheme,
        COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0) as total_credit,
        COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0) as total_debit,
        CASE
          WHEN p.type = 'customer' THEN
            (p.opening_balance -
              COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0) +
              COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0))
          ELSE
            (p.opening_balance +
              COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0))
        END as current_balance,
        COALESCE((SELECT SUM(ie.interest_amount - ie.adjustment)
                  FROM interest_entries ie
                  WHERE ie.party_id = p.id AND ie.status = 'pending'), 0) as pending_interest,
        CASE
          WHEN p.type = 'customer' THEN
            (p.opening_balance -
              COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0) +
              COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0))
          ELSE
            (p.opening_balance +
              COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.payment_target = 'principal' THEN t.amount ELSE 0 END), 0))
        END +
        COALESCE((SELECT SUM(ie.interest_amount - ie.adjustment)
                  FROM interest_entries ie
                  WHERE ie.party_id = p.id AND ie.status = 'pending'), 0) as outstanding
      FROM parties p
      LEFT JOIN transactions t ON p.id = t.party_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all();
  }

  getLastReceiptNumber(type) {
    const db = getDb();
    // credit transactions use the REC- prefix; debit transactions use PAY-
    const prefix = type === 'debit' ? 'PAY-%' : 'REC-%';
    const row = db.prepare(`
      SELECT receipt_number FROM transactions
      WHERE receipt_number IS NOT NULL
        AND receipt_number LIKE ?
      ORDER BY id DESC LIMIT 1
    `).get(prefix);
    return row ? row.receipt_number : null;
  }

  getRecentTransactions(limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, p.name as party_name, p.type as party_type
      FROM transactions t
      JOIN parties p ON t.party_id = p.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(limit);
  }

  getSummary() {
    const db = getDb();
    return db.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits
      FROM transactions
    `).get();
  }
}

module.exports = new TransactionRepository();
