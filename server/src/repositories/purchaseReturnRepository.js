const { getDb } = require('../db/database');

class PurchaseReturnRepository {
  getNextNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(CAST(return_number AS INTEGER)), 0) + 1 AS next
      FROM purchase_returns
    `).get();
    return String(row.next);
  }

  create({
    return_number, ledger_id, purchase_id, bill_number, date, time, reason,
    total_amount, total_discount, total_gst, item_count, notes, items,
  }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO purchase_returns (
        return_number, ledger_id, purchase_id, bill_number, date, time, reason,
        total_amount, total_discount, total_gst, item_count, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      return_number,
      ledger_id,
      purchase_id || null,
      (bill_number || '').toString().trim(),
      date,
      time || '',
      (reason || '').toString().trim(),
      total_amount,
      total_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || ''
    );
    const returnId = info.lastInsertRowid;
    if (Array.isArray(items)) this._insertItems(db, returnId, items);
    return this.getById(returnId);
  }

  _insertItems(db, returnId, items) {
    const stmt = db.prepare(`
      INSERT INTO purchase_return_items (
        purchase_return_id, item_id, item_name, unit, mrp, rate, quantity,
        discount_percent, gst_percent, gst_amount, amount, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach((line, idx) => {
      stmt.run(
        returnId,
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
    const ret = db.prepare(`
      SELECT r.*, l.name AS ledger_name, p.purchase_number
      FROM purchase_returns r
      JOIN ledgers l ON l.id = r.ledger_id
      LEFT JOIN purchases p ON p.id = r.purchase_id
      WHERE r.id = ?
    `).get(id);
    if (!ret) return null;
    ret.items = db.prepare(`
      SELECT * FROM purchase_return_items WHERE purchase_return_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);
    return ret;
  }

  getAll({ ledgerId, fromDate, toDate } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (ledgerId) { conds.push('r.ledger_id = ?'); params.push(ledgerId); }
    if (fromDate) { conds.push('r.date >= ?');    params.push(fromDate); }
    if (toDate)   { conds.push('r.date <= ?');    params.push(toDate); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT r.*, l.name AS ledger_name, p.purchase_number
      FROM purchase_returns r
      JOIN ledgers l ON l.id = r.ledger_id
      LEFT JOIN purchases p ON p.id = r.purchase_id
      ${where}
      ORDER BY r.date DESC, r.id DESC
    `).all(...params);
  }

  getByLedger(ledgerId) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT r.*, l.name AS ledger_name, p.purchase_number
      FROM purchase_returns r
      JOIN ledgers l ON l.id = r.ledger_id
      LEFT JOIN purchases p ON p.id = r.purchase_id
      WHERE r.ledger_id = ?
      ORDER BY r.date DESC, r.id DESC
    `).all(ledgerId);
    const itemStmt = db.prepare(`
      SELECT * FROM purchase_return_items WHERE purchase_return_id = ?
      ORDER BY sort_order ASC, id ASC
    `);
    return rows.map((r) => ({ ...r, items: itemStmt.all(r.id) }));
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM purchase_returns WHERE id = ?').run(id);
  }

  update(id, {
    ledger_id, purchase_id, bill_number, date, time, reason,
    total_amount, total_discount, total_gst, item_count, notes, items,
  }) {
    const db = getDb();
    db.prepare(`
      UPDATE purchase_returns
      SET ledger_id = ?, purchase_id = ?, bill_number = ?, date = ?, time = ?,
          reason = ?, total_amount = ?, total_discount = ?, total_gst = ?,
          item_count = ?, notes = ?
      WHERE id = ?
    `).run(
      ledger_id,
      purchase_id || null,
      (bill_number || '').toString().trim(),
      date,
      time || '',
      (reason || '').toString().trim(),
      total_amount,
      total_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || '',
      id
    );
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM purchase_return_items WHERE purchase_return_id = ?').run(id);
      this._insertItems(db, id, items);
    }
    return this.getById(id);
  }
}

module.exports = new PurchaseReturnRepository();
