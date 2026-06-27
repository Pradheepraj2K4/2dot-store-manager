const { getDb } = require('../db/database');

class LedgerRepository {
  findAll({ ledgerTypeId, status, behaviour } = {}) {
    const db = getDb();
    let query = `
      SELECT l.*, lt.name AS type_name, lt.behaviour,
             isc.name AS scheme_name, isc.nature AS scheme_nature
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      LEFT JOIN interest_schemes isc ON l.interest_scheme_id = isc.id
      WHERE 1=1
    `;
    const params = [];
    if (ledgerTypeId) { query += ' AND l.ledger_type_id = ?'; params.push(ledgerTypeId); }
    if (status) { query += ' AND l.status = ?'; params.push(status); }
    if (behaviour) { query += ' AND lt.behaviour = ?'; params.push(behaviour); }
    query += ' ORDER BY l.name ASC';
    return db.prepare(query).all(...params);
  }

  findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT l.*, lt.name AS type_name, lt.behaviour,
             isc.name AS scheme_name, isc.nature AS scheme_nature
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      LEFT JOIN interest_schemes isc ON l.interest_scheme_id = isc.id
      WHERE l.id = ?
    `).get(id);
  }

  create(data) {
    const db = getDb();
    // Resolve interest_scheme nature from interest_scheme_id if provided
    let interest_scheme = data.interest_scheme || 'NONE';
    const interest_scheme_id = data.interest_scheme_id ? parseInt(data.interest_scheme_id) : null;
    if (interest_scheme_id) {
      const scheme = db.prepare('SELECT nature FROM interest_schemes WHERE id = ?').get(interest_scheme_id);
      if (scheme) interest_scheme = scheme.nature;
    }
    const stmt = db.prepare(`
      INSERT INTO ledgers (ledger_type_id, name, address, phone, place, gst_no, state_code, igst_status,
                           opening_balance, current_balance, interest_rate, interest_scheme, interest_scheme_id, ledger_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const openingBalance = parseFloat(data.opening_balance) || 0;
    const result = stmt.run(
      data.ledger_type_id,
      data.name,
      data.address || '',
      data.phone || '',
      data.place || '',
      data.gst_no || '',
      data.state_code || '',
      data.igst_status || 'NO',
      openingBalance,
      openingBalance,
      data.interest_rate || 0,
      interest_scheme,
      interest_scheme_id,
      data.ledger_date || '',
      data.notes || ''
    );
    return this.findById(result.lastInsertRowid);
  }

  update(id, data) {
    const db = getDb();
    // Resolve interest_scheme nature from interest_scheme_id if provided
    let interest_scheme = data.interest_scheme || 'NONE';
    const interest_scheme_id = data.interest_scheme_id ? parseInt(data.interest_scheme_id) : null;
    if (interest_scheme_id) {
      const scheme = db.prepare('SELECT nature FROM interest_schemes WHERE id = ?').get(interest_scheme_id);
      if (scheme) interest_scheme = scheme.nature;
    }
    db.prepare(`
      UPDATE ledgers
      SET ledger_type_id = ?, name = ?, address = ?, phone = ?, place = ?,
          gst_no = ?, state_code = ?, igst_status = ?,
          interest_rate = ?, interest_scheme = ?, interest_scheme_id = ?,
          ledger_date = ?, notes = ?, status = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      data.ledger_type_id, data.name, data.address || '', data.phone || '', data.place || '',
      data.gst_no || '', data.state_code || '', data.igst_status || 'NO',
      data.interest_rate || 0, interest_scheme, interest_scheme_id,
      data.ledger_date || '', data.notes || '',
      data.status || 'active', id
    );
    return this.findById(id);
  }

  updateBalance(id, newBalance) {
    const db = getDb();
    db.prepare(`
      UPDATE ledgers SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `).run(newBalance, id);
    return this.findById(id);
  }

  close(id) {
    const db = getDb();
    db.prepare(`UPDATE ledgers SET status = 'closed', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(id);
    return this.findById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM ledgers WHERE id = ?').run(id);
  }

  findCash() {
    const db = getDb();
    return db.prepare(`
      SELECT l.*, lt.name AS type_name, lt.behaviour
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE l.is_system = 1 AND l.name = 'CASH'
      LIMIT 1
    `).get();
  }

  search(query) {
    const db = getDb();
    const like = `%${query}%`;
    return db.prepare(`
      SELECT l.*, lt.name AS type_name, lt.behaviour
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE l.name LIKE ? OR l.phone LIKE ? OR l.place LIKE ?
      ORDER BY l.name ASC
    `).all(like, like, like);
  }

  count() {
    const db = getDb();
    return db.prepare(`
      SELECT lt.id AS ledger_type_id, lt.name AS type_name, lt.behaviour, COUNT(l.id) as count
      FROM ledger_types lt
      LEFT JOIN ledgers l ON l.ledger_type_id = lt.id
      GROUP BY lt.id
    `).all();
  }

  getAllWithOutstanding() {
    const db = getDb();
    return db.prepare(`
      SELECT l.*, lt.name AS type_name, lt.behaviour,
        COALESCE((SELECT SUM(ie.amount) FROM interest_entries ie
                  WHERE ie.ledger_id = l.id AND ie.status = 'pending'), 0) AS pending_interest,
        l.current_balance + COALESCE((SELECT SUM(ie.amount) FROM interest_entries ie
                  WHERE ie.ledger_id = l.id AND ie.status = 'pending'), 0) AS outstanding,
        COALESCE((SELECT SUM(t.amount) FROM transactions t
                  WHERE t.ledger_id = l.id AND t.entry_type = 'payment'), 0) AS total_payments,
        COALESCE((SELECT SUM(t.amount) FROM transactions t
                  WHERE t.ledger_id = l.id AND t.entry_type = 'receipt'), 0) AS total_receipts
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      ORDER BY l.name ASC
    `).all();
  }

  getOutstandingByType(ledgerTypeId) {
    const db = getDb();
    return db.prepare(`
      SELECT l.*, lt.name AS type_name, lt.behaviour,
        COALESCE((SELECT SUM(ie.amount) FROM interest_entries ie
                  WHERE ie.ledger_id = l.id AND ie.status = 'pending'), 0) AS pending_interest,
        l.current_balance + COALESCE((SELECT SUM(ie.amount) FROM interest_entries ie
                  WHERE ie.ledger_id = l.id AND ie.status = 'pending'), 0) AS outstanding
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      WHERE l.ledger_type_id = ? AND l.status = 'active'
      ORDER BY l.current_balance DESC
    `).all(ledgerTypeId);
  }

  getWithPendingInterest() {
    const db = getDb();
    return db.prepare(`
      SELECT l.*, lt.name AS type_name, lt.behaviour,
        COALESCE(SUM(ie.amount), 0)                           AS pending_interest,
        COUNT(ie.id)                                           AS pending_count,
        l.current_balance + COALESCE(SUM(ie.amount), 0)       AS outstanding,
        MIN(ie.from_date)                                      AS earliest_pending_date
      FROM ledgers l
      JOIN ledger_types lt ON l.ledger_type_id = lt.id
      JOIN interest_entries ie ON ie.ledger_id = l.id AND ie.status = 'pending'
      WHERE l.status = 'active'
      GROUP BY l.id
      HAVING pending_interest > 0
      ORDER BY pending_interest DESC
    `).all();
  }
}

module.exports = new LedgerRepository();
