const { getDb } = require('../db/database');

class TransactionRepository {
  findAll({ ledgerId, entryType, fromDate, toDate, ledgerTypeId, behaviour } = {}) {
    const db = getDb();
    let query = `
      SELECT t.*, l.name AS ledger_name, lt.name AS type_name, lt.behaviour,
             l.phone AS ledger_phone, l.place AS ledger_place
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE 1=1
    `;
    const params = [];
    if (ledgerId) { query += ' AND t.ledger_id = ?'; params.push(ledgerId); }
    if (entryType) { query += ' AND t.entry_type = ?'; params.push(entryType); }
    if (fromDate) { query += ' AND t.date >= ?'; params.push(fromDate); }
    if (toDate) { query += ' AND t.date <= ?'; params.push(toDate); }
    if (ledgerTypeId) { query += ' AND l.ledger_type_id = ?'; params.push(ledgerTypeId); }
    if (behaviour) { query += ' AND lt.behaviour = ?'; params.push(behaviour); }
    query += ' ORDER BY t.date DESC, t.id DESC';
    return db.prepare(query).all(...params);
  }

  findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, l.name AS ledger_name, lt.name AS type_name, lt.behaviour
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE t.id = ?
    `).get(id);
  }

  findByLedgerId(ledgerId) {
    const db = getDb();
    return db.prepare(`
      SELECT t.* FROM transactions t WHERE t.ledger_id = ? ORDER BY t.date DESC, t.id DESC
    `).all(ledgerId);
  }

  create({ ledger_id, entry_type, amount, date, reference, notes, running_number, interest_entry_id }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO transactions (ledger_id, entry_type, amount, date, reference, notes, running_number, interest_entry_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      ledger_id, entry_type, amount, date,
      reference || '', notes || '', running_number, interest_entry_id || null
    );
    return this.findById(result.lastInsertRowid);
  }

  getNextRunningNumber(entryType) {
    const db = getDb();
    const prefix = entryType === 'payment' ? 'PAY' : 'REC';
    const row = db.prepare(`
      SELECT running_number FROM transactions
      WHERE entry_type = ? AND running_number LIKE ?
      ORDER BY id DESC LIMIT 1
    `).get(entryType, `${prefix}-%`);
    if (!row || !row.running_number) return `${prefix}-00001`;
    const match = row.running_number.match(/(\d+)$/);
    if (!match) return `${prefix}-00001`;
    const num = parseInt(match[1]) + 1;
    return `${prefix}-${String(num).padStart(5, '0')}`;
  }

  getSummary({ fromDate, toDate } = {}) {
    const db = getDb();
    let query = `
      SELECT t.entry_type, COUNT(*) AS count, SUM(t.amount) AS total
      FROM transactions t WHERE 1=1
    `;
    const params = [];
    if (fromDate) { query += ' AND t.date >= ?'; params.push(fromDate); }
    if (toDate) { query += ' AND t.date <= ?'; params.push(toDate); }
    query += ' GROUP BY t.entry_type';
    return db.prepare(query).all(...params);
  }

  getRecentTransactions(limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, l.name AS ledger_name, lt.name AS type_name, lt.behaviour
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      ORDER BY t.date DESC, t.id DESC
      LIMIT ?
    `).all(limit);
  }

  deleteById(id) {
    const db = getDb();
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  }
}

module.exports = new TransactionRepository();
