const { getDb } = require('../db/database');

class SaleRepository {
  getNextSaleNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(CAST(sale_number AS INTEGER)), 0) + 1 AS next
      FROM sales
    `).get();
    return String(row.next);
  }

  create({ sale_number, ledger_id, date, time, total_amount, total_discount, item_count, notes, items }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO sales (sale_number, ledger_id, date, time, total_amount, total_discount, item_count, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sale_number,
      ledger_id,
      date,
      time || '',
      total_amount,
      total_discount || 0,
      item_count || (items ? items.length : 0),
      notes || ''
    );
    const saleId = info.lastInsertRowid;
    if (Array.isArray(items)) {
      const stmt = db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, item_name, unit, mrp, rate, quantity, discount_percent, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((line, idx) => {
        stmt.run(
          saleId,
          line.item_id || null,
          line.item_name,
          line.unit || 'Nos',
          parseFloat(line.mrp) || 0,
          parseFloat(line.rate) || 0,
          parseFloat(line.quantity) || 1,
          parseFloat(line.discount_percent) || 0,
          parseFloat(line.amount) || 0,
          idx
        );
      });
    }
    return this.getById(saleId);
  }

  getById(id) {
    const db = getDb();
    const sale = db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM sales s
      JOIN ledgers l ON l.id = s.ledger_id
      WHERE s.id = ?
    `).get(id);
    if (!sale) return null;
    sale.items = db.prepare(`
      SELECT * FROM sale_items WHERE sale_id = ? ORDER BY sort_order ASC, id ASC
    `).all(id);
    return sale;
  }

  getAll({ ledgerId, fromDate, toDate } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (ledgerId)  { conds.push('s.ledger_id = ?'); params.push(ledgerId); }
    if (fromDate)  { conds.push('s.date >= ?');    params.push(fromDate); }
    if (toDate)    { conds.push('s.date <= ?');    params.push(toDate); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM sales s
      JOIN ledgers l ON l.id = s.ledger_id
      ${where}
      ORDER BY s.date DESC, s.id DESC
    `).all(...params);
  }

  getByLedger(ledgerId) {
    const db = getDb();
    const sales = db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM sales s
      JOIN ledgers l ON l.id = s.ledger_id
      WHERE s.ledger_id = ?
      ORDER BY s.date DESC, s.id DESC
    `).all(ledgerId);
    const itemStmt = db.prepare(`
      SELECT * FROM sale_items WHERE sale_id = ? ORDER BY sort_order ASC, id ASC
    `);
    return sales.map((s) => ({ ...s, items: itemStmt.all(s.id) }));
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM sales WHERE id = ?').run(id);
  }

  update(id, { date, time, total_amount, total_discount, item_count, notes, items }) {
    const db = getDb();
    db.prepare(`
      UPDATE sales
      SET date = ?, time = ?, total_amount = ?, total_discount = ?, item_count = ?, notes = ?
      WHERE id = ?
    `).run(
      date,
      time || '',
      total_amount,
      total_discount || 0,
      item_count || (items ? items.length : 0),
      notes || '',
      id
    );
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      const stmt = db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, item_name, unit, mrp, rate, quantity, discount_percent, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          parseFloat(line.amount) || 0,
          idx
        );
      });
    }
    return this.getById(id);
  }
}

module.exports = new SaleRepository();
