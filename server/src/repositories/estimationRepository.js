const { getDb } = require('../db/database');

class EstimationRepository {
  getNextNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(CAST(estimation_number AS INTEGER)), 0) + 1 AS next
      FROM estimations
    `).get();
    return String(row.next);
  }

  create({
    estimation_number, ledger_id, customer_name, date, time, valid_until,
    total_amount, total_discount, total_gst, item_count, notes, items,
  }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO estimations (
        estimation_number, ledger_id, customer_name, date, time, valid_until,
        total_amount, total_discount, total_gst, item_count, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      estimation_number,
      ledger_id || null,
      (customer_name || '').toString().trim(),
      date,
      time || '',
      valid_until || '',
      total_amount,
      total_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || ''
    );
    const estimationId = info.lastInsertRowid;
    if (Array.isArray(items)) this._insertItems(db, estimationId, items);
    return this.getById(estimationId);
  }

  _insertItems(db, estimationId, items) {
    const stmt = db.prepare(`
      INSERT INTO estimation_items (
        estimation_id, item_id, item_name, unit, mrp, rate, quantity,
        discount_percent, gst_percent, gst_amount, amount, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach((line, idx) => {
      stmt.run(
        estimationId,
        line.item_id || null,
        line.item_name,
        line.unit || 'Nos',
        parseFloat(line.mrp) || 0,
        parseFloat(line.rate) || 0,
        parseFloat(line.quantity) || 1,
        parseFloat(line.discount_percent) || 0,
        parseFloat(line.gst_percent) || 0,
        parseFloat(line.gst_amount) || 0,
        parseFloat(line.amount) || 0,
        idx
      );
    });
  }

  getById(id) {
    const db = getDb();
    const est = db.prepare(`
      SELECT e.*, l.name AS ledger_name
      FROM estimations e
      LEFT JOIN ledgers l ON l.id = e.ledger_id
      WHERE e.id = ?
    `).get(id);
    if (!est) return null;
    est.items = db.prepare(`
      SELECT * FROM estimation_items WHERE estimation_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);
    return est;
  }

  getAll({ ledgerId, fromDate, toDate, status } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (ledgerId) { conds.push('e.ledger_id = ?'); params.push(ledgerId); }
    if (fromDate) { conds.push('e.date >= ?');    params.push(fromDate); }
    if (toDate)   { conds.push('e.date <= ?');    params.push(toDate); }
    if (status)   { conds.push('e.status = ?');   params.push(status); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT e.*, l.name AS ledger_name
      FROM estimations e
      LEFT JOIN ledgers l ON l.id = e.ledger_id
      ${where}
      ORDER BY e.date DESC, e.id DESC
    `).all(...params);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM estimations WHERE id = ?').run(id);
  }

  update(id, {
    ledger_id, customer_name, date, time, valid_until,
    total_amount, total_discount, total_gst, item_count, notes, items, status,
  }) {
    const db = getDb();
    db.prepare(`
      UPDATE estimations
      SET ledger_id = ?, customer_name = ?, date = ?, time = ?, valid_until = ?,
          total_amount = ?, total_discount = ?, total_gst = ?,
          item_count = ?, notes = ?, status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      ledger_id || null,
      (customer_name || '').toString().trim(),
      date,
      time || '',
      valid_until || '',
      total_amount,
      total_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || '',
      status || null,
      id
    );
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM estimation_items WHERE estimation_id = ?').run(id);
      this._insertItems(db, id, items);
    }
    return this.getById(id);
  }

  markConverted(id, saleId) {
    const db = getDb();
    db.prepare(`
      UPDATE estimations
      SET status = 'converted', converted_sale_id = ?
      WHERE id = ?
    `).run(saleId, id);
  }
}

module.exports = new EstimationRepository();
