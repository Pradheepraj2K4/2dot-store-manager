const { getDb } = require('../db/database');

class InterestRepository {
  findAll({ ledgerId, status, fromDate, toDate } = {}) {
    const db = getDb();
    let query = `
      SELECT ie.*, l.name AS ledger_name, lt.name AS type_name, lt.behaviour,
             l.current_balance, l.interest_rate AS ledger_rate, l.interest_scheme AS ledger_scheme
      FROM interest_entries ie
      JOIN ledgers l ON ie.ledger_id = l.id
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE 1=1
    `;
    const params = [];
    if (ledgerId) { query += ' AND ie.ledger_id = ?'; params.push(ledgerId); }
    if (status) { query += ' AND ie.status = ?'; params.push(status); }
    if (fromDate) { query += ' AND ie.from_date >= ?'; params.push(fromDate); }
    if (toDate) { query += ' AND ie.to_date <= ?'; params.push(toDate); }
    query += ' ORDER BY ie.from_date DESC, ie.id DESC';
    return db.prepare(query).all(...params);
  }

  findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT ie.*, l.name AS ledger_name, lt.name AS type_name, lt.behaviour,
             l.current_balance
      FROM interest_entries ie
      JOIN ledgers l ON ie.ledger_id = l.id
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE ie.id = ?
    `).get(id);
  }

  findByLedgerId(ledgerId) {
    const db = getDb();
    return db.prepare('SELECT * FROM interest_entries WHERE ledger_id = ? ORDER BY from_date ASC, id ASC').all(ledgerId);
  }

  getPendingByLedger(ledgerId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM interest_entries WHERE ledger_id = ? AND status = 'pending' ORDER BY from_date ASC, id ASC
    `).all(ledgerId);
  }

  getTotalPendingByLedger(ledgerId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_pending FROM interest_entries WHERE ledger_id = ? AND status = 'pending'
    `).get(ledgerId);
    return row ? row.total_pending : 0;
  }

  getTotalPendingAll() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_pending FROM interest_entries WHERE status = 'pending'
    `).get();
    return row ? row.total_pending : 0;
  }

  getTotalPendingByBehaviour(behaviour) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(ie.amount), 0) AS total_pending
      FROM interest_entries ie
      JOIN ledgers l ON ie.ledger_id = l.id
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE ie.status = 'pending' AND lt.behaviour = ?
    `).get(behaviour);
    return row ? row.total_pending : 0;
  }

  getLastEntryToDate(ledgerId) {
    const db = getDb();
    const row = db.prepare('SELECT MAX(to_date) AS last_to_date FROM interest_entries WHERE ledger_id = ?').get(ledgerId);
    return row ? row.last_to_date : null;
  }

  existsForPeriod(ledgerId, fromDate, toDate) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS cnt FROM interest_entries WHERE ledger_id = ? AND from_date = ? AND to_date = ?').get(ledgerId, fromDate, toDate);
    return row.cnt > 0;
  }

  getNextInterestNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT interest_number FROM interest_entries
      WHERE interest_number LIKE 'INT-%'
      ORDER BY id DESC LIMIT 1
    `).get();
    if (!row || !row.interest_number) return 'INT-00001';
    const match = row.interest_number.match(/(\d+)$/);
    if (!match) return 'INT-00001';
    return `INT-${String(parseInt(match[1]) + 1).padStart(5, '0')}`;
  }

  create({ ledger_id, amount, from_date, to_date, days, rate, principal_at_time }) {
    const db = getDb();
    const interest_number = this.getNextInterestNumber();
    const stmt = db.prepare(`
      INSERT INTO interest_entries (ledger_id, amount, from_date, to_date, days, rate, principal_at_time, interest_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(ledger_id, amount, from_date, to_date, days, rate, principal_at_time, interest_number);
    return this.findById(result.lastInsertRowid);
  }

  createMany(entries) {
    const db = getDb();
    const firstNum = this.getNextInterestNumber();
    const firstIdx = parseInt(firstNum.match(/(\d+)$/)[1]);
    const stmt = db.prepare(`
      INSERT INTO interest_entries (ledger_id, amount, from_date, to_date, days, rate, principal_at_time, interest_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAll = db.transaction((items) => {
      items.forEach((e, i) => {
        const interest_number = `INT-${String(firstIdx + i).padStart(5, '0')}`;
        stmt.run(e.ledger_id, e.amount, e.from_date, e.to_date, e.days, e.rate, e.principal_at_time, interest_number);
      });
    });
    insertAll(entries);
  }

  markPaid(id, paidDate, amount) {
    const db = getDb();
    if (amount != null) {
      db.prepare("UPDATE interest_entries SET status = 'paid', paid_date = ?, amount = ? WHERE id = ?").run(paidDate, amount, id);
    } else {
      db.prepare("UPDATE interest_entries SET status = 'paid', paid_date = ? WHERE id = ?").run(paidDate, id);
    }
    return this.findById(id);
  }

  deleteByLedgerId(ledgerId) {
    const db = getDb();
    return db.prepare('DELETE FROM interest_entries WHERE ledger_id = ?').run(ledgerId);
  }

  unmarkPaid(id) {
    const db = getDb();
    db.prepare("UPDATE interest_entries SET status = 'pending', paid_date = NULL WHERE id = ?").run(id);
    return this.findById(id);
  }

  deleteById(id) {
    const db = getDb();
    return db.prepare('DELETE FROM interest_entries WHERE id = ?').run(id);
  }
}

module.exports = new InterestRepository();
