const { getDb } = require('../db/database');

class PurchaseRepository {
  getNextPurchaseNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(CAST(purchase_number AS INTEGER)), 0) + 1 AS next
      FROM purchases
    `).get();
    return String(row.next);
  }

  create({ purchase_number, ledger_id, bill_number, date, time, total_amount, total_discount, bill_discount, total_gst, item_count, notes, items }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO purchases (purchase_number, ledger_id, bill_number, date, time, total_amount, total_discount, bill_discount, total_gst, item_count, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchase_number,
      ledger_id,
      (bill_number || '').toString().trim(),
      date,
      time || '',
      total_amount,
      total_discount || 0,
      bill_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || ''
    );
    const purchaseId = info.lastInsertRowid;
    if (Array.isArray(items)) {
      const stmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, item_id, item_name, unit, mrp, rate, quantity, discount_percent, gst_percent, gst_amount, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((line, idx) => {
        stmt.run(
          purchaseId,
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
    return this.getById(purchaseId);
  }

  getById(id) {
    const db = getDb();
    const purchase = db.prepare(`
      SELECT p.*, l.name AS ledger_name
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      WHERE p.id = ?
    `).get(id);
    if (!purchase) return null;
    purchase.items = db.prepare(`
      SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY sort_order ASC, id ASC
    `).all(id);
    return purchase;
  }

  getAll({ ledgerId, fromDate, toDate } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (ledgerId) { conds.push('p.ledger_id = ?'); params.push(ledgerId); }
    if (fromDate) { conds.push('p.date >= ?');    params.push(fromDate); }
    if (toDate)   { conds.push('p.date <= ?');    params.push(toDate); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT p.*, l.name AS ledger_name
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      ${where}
      ORDER BY p.date DESC, p.id DESC
    `).all(...params);
  }

  getByLedger(ledgerId) {
    const db = getDb();
    const purchases = db.prepare(`
      SELECT p.*, l.name AS ledger_name
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      WHERE p.ledger_id = ?
      ORDER BY p.date DESC, p.id DESC
    `).all(ledgerId);
    const itemStmt = db.prepare(`
      SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY sort_order ASC, id ASC
    `);
    return purchases.map((p) => ({ ...p, items: itemStmt.all(p.id) }));
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
  }

  update(id, { ledger_id, bill_number, date, time, total_amount, total_discount, bill_discount, total_gst, item_count, notes, items }) {
    const db = getDb();
    db.prepare(`
      UPDATE purchases
      SET ledger_id = ?, bill_number = ?, date = ?, time = ?, total_amount = ?,
          total_discount = ?, bill_discount = ?, total_gst = ?, item_count = ?, notes = ?
      WHERE id = ?
    `).run(
      ledger_id,
      (bill_number || '').toString().trim(),
      date,
      time || '',
      total_amount,
      total_discount || 0,
      bill_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || '',
      id
    );
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
      const stmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, item_id, item_name, unit, mrp, rate, quantity, discount_percent, gst_percent, gst_amount, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((line, idx) => {
        stmt.run(
          id,
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
    return this.getById(id);
  }
}

module.exports = new PurchaseRepository();
