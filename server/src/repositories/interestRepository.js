const { getDb } = require('../db/database');

class InterestRepository {
  findAll({ partyId, status, startDate, endDate } = {}) {
    const db = getDb();
    let query = `
      SELECT ie.*, p.name as party_name, p.type as party_type
      FROM interest_entries ie
      JOIN parties p ON ie.party_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (partyId) {
      query += ' AND ie.party_id = ?';
      params.push(partyId);
    }
    if (status) {
      query += ' AND ie.status = ?';
      params.push(status);
    }
    if (startDate) {
      query += ' AND ie.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND ie.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY ie.date DESC, ie.id DESC';
    return db.prepare(query).all(...params);
  }

  findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT ie.*, p.name as party_name, p.type as party_type
      FROM interest_entries ie
      JOIN parties p ON ie.party_id = p.id
      WHERE ie.id = ?
    `).get(id);
  }

  findByPartyId(partyId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM interest_entries
      WHERE party_id = ?
      ORDER BY date ASC, id ASC
    `).all(partyId);
  }

  create({ party_id, date, principal, rate, scheme, interest_amount, notes }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO interest_entries (party_id, date, principal, rate, scheme, interest_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(party_id, date, principal, rate, scheme, interest_amount, notes || '');
    return this.findById(result.lastInsertRowid);
  }

  createMany(entries) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO interest_entries (party_id, date, principal, rate, scheme, interest_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAll = db.transaction((items) => {
      for (const e of items) {
        stmt.run(e.party_id, e.date, e.principal, e.rate, e.scheme, e.interest_amount, e.notes || '');
      }
    });
    insertAll(entries);
  }

  adjust(id, { adjustment, notes, status }) {
    const db = getDb();
    db.prepare(`
      UPDATE interest_entries
      SET adjustment = ?, notes = ?, status = ?
      WHERE id = ?
    `).run(adjustment, notes || '', status || 'adjusted', id);
    return this.findById(id);
  }

  waive(id, notes) {
    const db = getDb();
    const entry = this.findById(id);
    if (!entry) return null;
    db.prepare(`
      UPDATE interest_entries
      SET adjustment = ?, status = 'waived', notes = ?
      WHERE id = ?
    `).run(entry.interest_amount, notes || 'Waived', id);
    return this.findById(id);
  }

  deleteByPartyId(partyId) {
    const db = getDb();
    return db.prepare('DELETE FROM interest_entries WHERE party_id = ?').run(partyId);
  }

  getLastEntryDate(partyId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT MAX(date) as last_date FROM interest_entries WHERE party_id = ?
    `).get(partyId);
    return row ? row.last_date : null;
  }

  getPendingByParty(partyId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM interest_entries
      WHERE party_id = ? AND status = 'pending'
      ORDER BY date ASC
    `).all(partyId);
  }

  getSummaryByParty() {
    const db = getDb();
    return db.prepare(`
      SELECT
        p.id,
        p.name,
        p.type as party_type,
        p.opening_balance,
        p.interest_rate,
        p.interest_scheme,
        COUNT(ie.id) as total_entries,
        COALESCE(SUM(ie.interest_amount), 0) as total_interest,
        COALESCE(SUM(ie.adjustment), 0) as total_adjusted,
        COALESCE(SUM(CASE WHEN ie.status = 'pending' THEN ie.interest_amount - ie.adjustment ELSE 0 END), 0) as pending_interest,
        CASE
          WHEN p.type = 'customer' THEN
            (p.opening_balance -
              COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.id AND t.type = 'credit' AND t.payment_target = 'principal'), 0) +
              COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.id AND t.type = 'debit'  AND t.payment_target = 'principal'), 0))
          ELSE
            (p.opening_balance +
              COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.id AND t.type = 'credit' AND t.payment_target = 'principal'), 0) -
              COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.id AND t.type = 'debit'  AND t.payment_target = 'principal'), 0))
        END as current_balance
      FROM parties p
      LEFT JOIN interest_entries ie ON p.id = ie.party_id
      WHERE p.interest_scheme != 'NONE' AND p.interest_rate > 0
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all();
  }

  getTotalPendingInterest(partyId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(interest_amount - adjustment), 0) as total_pending
      FROM interest_entries
      WHERE party_id = ? AND status = 'pending'
    `).get(partyId);
    return row ? row.total_pending : 0;
  }

  existsForDate(partyId, date) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM interest_entries
      WHERE party_id = ? AND date = ?
    `).get(partyId, date);
    return row.cnt > 0;
  }

  /**
   * Settle pending interest entries for a party with a payment amount.
   * Allocates oldest-first. Returns the total amount actually settled.
   */
  settleWithAmount(partyId, paymentAmount) {
    const db = getDb();
    const pending = this.getPendingByParty(partyId); // ordered date ASC
    let remaining = paymentAmount;
    let totalSettled = 0;

    const updateStmt = db.prepare(`
      UPDATE interest_entries
      SET adjustment = ?, status = ?, notes = CASE WHEN notes = '' THEN ? ELSE notes || '; ' || ? END
      WHERE id = ?
    `);

    const settle = db.transaction(() => {
      for (const entry of pending) {
        if (remaining <= 0) break;
        const owed = entry.interest_amount - entry.adjustment;
        if (owed <= 0) continue;

        if (remaining >= owed) {
          // Fully settle this entry
          updateStmt.run(entry.interest_amount, 'adjusted', 'Settled via payment', 'Settled via payment', entry.id);
          remaining -= owed;
          totalSettled += owed;
        } else {
          // Partially settle
          const newAdj = entry.adjustment + remaining;
          updateStmt.run(newAdj, 'adjusted', 'Partial payment', 'Partial payment', entry.id);
          totalSettled += remaining;
          remaining = 0;
        }
      }
    });

    settle();
    return totalSettled;
  }
}

module.exports = new InterestRepository();
