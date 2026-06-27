const { getDb } = require('../db/database');
const imeiRepository = require('./imeiRepository');

class SaleRepository {
  getNextSaleNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(CAST(sale_number AS INTEGER)), 0) + 1 AS next
      FROM sales
    `).get();
    return String(row.next);
  }

  create({ sale_number, ledger_id, date, time, total_amount, total_discount, bill_discount, total_gst, item_count, notes, customer_name, customer_mobile, customer_place, customer_id, items }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO sales (sale_number, ledger_id, date, time, total_amount, total_discount, bill_discount, total_gst, item_count, notes, customer_name, customer_mobile, customer_place, customer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sale_number,
      ledger_id,
      date,
      time || '',
      total_amount,
      total_discount || 0,
      bill_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || '',
      customer_name || '',
      customer_mobile || '',
      customer_place || '',
      customer_id || null
    );
    const saleId = info.lastInsertRowid;
    if (Array.isArray(items)) {
      const stmt = db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, item_name, unit, mrp, rate, quantity, discount_percent, gst_percent, gst_amount, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          parseFloat(line.gst_percent) || 0,
          parseFloat(line.gst_amount) || 0,
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
    // Attach the IMEIs consumed by this sale, grouped per item, so the edit
    // screen can re-populate the per-line IMEI selections.
    const imeiRows = imeiRepository.getBySale(id);
    const byItem = new Map();
    for (const row of imeiRows) {
      if (!byItem.has(row.item_id)) byItem.set(row.item_id, []);
      byItem.get(row.item_id).push(row.imei);
    }
    sale.items = sale.items.map((line) => ({
      ...line,
      imeis: line.item_id ? (byItem.get(line.item_id) || []) : [],
    }));
    return sale;
  }

  getAll({ ledgerId, fromDate, toDate, search, limit } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (ledgerId)  { conds.push('s.ledger_id = ?'); params.push(ledgerId); }
    if (fromDate)  { conds.push('s.date >= ?');    params.push(fromDate); }
    if (toDate)    { conds.push('s.date <= ?');    params.push(toDate); }
    if (search && String(search).trim()) {
      const like = `%${String(search).trim()}%`;
      conds.push(`(
        s.sale_number LIKE ? OR
        l.name LIKE ? OR
        s.customer_name LIKE ? OR
        s.customer_mobile LIKE ? OR
        EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.item_name LIKE ?) OR
        EXISTS (SELECT 1 FROM item_imeis iu WHERE iu.sale_id = s.id AND iu.imei LIKE ?)
      )`);
      params.push(like, like, like, like, like, like);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT ${parseInt(limit, 10)}` : '';
    return db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM sales s
      JOIN ledgers l ON l.id = s.ledger_id
      ${where}
      ORDER BY s.date DESC, s.id DESC
      ${limitClause}
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

  /**
   * Per-bill profit over a date range.
   *
   * Revenue per line = its stored `amount` (what the customer pays for that
   * line). Cost per line = the item's weighted-average purchase rate × qty,
   * derived from all `purchase_items` rows for that item. Bill-level discount
   * is returned separately so the service can subtract it from revenue.
   *
   * `unknown_cost_lines` counts lines with no purchase history (or no linked
   * item) so the UI can flag bills whose cost is incomplete.
   */
  getBillProfit({ fromDate, toDate } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (fromDate) { conds.push('s.date >= ?'); params.push(fromDate); }
    if (toDate)   { conds.push('s.date <= ?'); params.push(toDate); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.prepare(`
      WITH item_cost AS (
        SELECT item_id,
               SUM(rate * quantity) / NULLIF(SUM(quantity), 0) AS avg_cost
        FROM purchase_items
        WHERE item_id IS NOT NULL
        GROUP BY item_id
      )
      SELECT
        s.id,
        s.sale_number,
        s.date,
        s.time,
        s.bill_discount,
        s.item_count,
        COALESCE(NULLIF(TRIM(s.customer_name), ''), l.name) AS party_name,
        COALESCE(SUM(si.amount), 0)                              AS line_amount,
        COALESCE(SUM(COALESCE(ic.avg_cost, 0) * si.quantity), 0) AS cost,
        SUM(CASE WHEN si.id IS NOT NULL AND ic.avg_cost IS NULL THEN 1 ELSE 0 END) AS unknown_cost_lines
      FROM sales s
      JOIN ledgers l ON l.id = s.ledger_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN item_cost ic ON ic.item_id = si.item_id
      ${where}
      GROUP BY s.id
      ORDER BY s.date DESC, s.id DESC
    `).all(...params);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM sales WHERE id = ?').run(id);
  }

  update(id, { date, time, total_amount, total_discount, bill_discount, total_gst, item_count, notes, customer_name, customer_mobile, customer_place, customer_id, items }) {
    const db = getDb();
    db.prepare(`
      UPDATE sales
      SET date = ?, time = ?, total_amount = ?, total_discount = ?, bill_discount = ?, total_gst = ?, item_count = ?, notes = ?, customer_name = ?, customer_mobile = ?, customer_place = ?, customer_id = ?
      WHERE id = ?
    `).run(
      date,
      time || '',
      total_amount,
      total_discount || 0,
      bill_discount || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || '',
      customer_name || '',
      customer_mobile || '',
      customer_place || '',
      customer_id || null,
      id
    );
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      const stmt = db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, item_name, unit, mrp, rate, quantity, discount_percent, gst_percent, gst_amount, amount, sort_order)
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

module.exports = new SaleRepository();
