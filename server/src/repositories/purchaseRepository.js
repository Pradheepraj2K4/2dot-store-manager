const { getDb } = require("../db/database");
const imeiRepository = require("./imeiRepository");

class PurchaseRepository {
  getNextPurchaseNumber() {
    const db = getDb();
    const row = db
      .prepare(
        `
      SELECT COALESCE(MAX(CAST(purchase_number AS INTEGER)), 0) + 1 AS next
      FROM purchases
    `,
      )
      .get();
    return String(row.next);
  }

  create({
    purchase_number,
    ledger_id,
    bill_number,
    po_number,
    date,
    time,
    total_amount,
    total_discount,
    bill_discount,
    freight_charge,
    total_gst,
    item_count,
    notes,
    items,
  }) {
    const db = getDb();
    const info = db
      .prepare(
        `
      INSERT INTO purchases (purchase_number, ledger_id, bill_number, po_number, date, time, total_amount, total_discount, bill_discount, freight_charge, total_gst, item_count, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        purchase_number,
        ledger_id,
        (bill_number || "").toString().trim(),
        (po_number || "").toString().trim(),
        date,
        time || "",
        total_amount,
        total_discount || 0,
        bill_discount || 0,
        freight_charge || 0,
        total_gst || 0,
        item_count || (items ? items.length : 0),
        notes || "",
      );
    const purchaseId = info.lastInsertRowid;
    if (Array.isArray(items)) {
      const stmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, item_id, item_name, unit, mrp, rate, sales_rate, quantity, discount_percent, gst_percent, gst_amount, amount, batch_no, batch_id, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((line, idx) => {
        stmt.run(
          purchaseId,
          line.item_id || null,
          line.item_name,
          line.unit || "Nos",
          parseFloat(line.mrp) || 0,
          parseFloat(line.rate) || 0,
          line.sales_rate != null && line.sales_rate !== ""
            ? parseFloat(line.sales_rate)
            : null,
          parseFloat(line.quantity) || 1,
          parseFloat(line.discount_percent) || 0,
          parseFloat(line.gst_percent) || 0,
          parseFloat(line.gst_amount) || 0,
          parseFloat(line.amount) || 0,
          (line.batch_no || "").toString().trim(),
          line.batch_id || null,
          idx,
        );
      });
    }
    return this.getById(purchaseId);
  }

  getById(id) {
    const db = getDb();
    const purchase = db
      .prepare(
        `
      SELECT p.*, l.name AS ledger_name
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      WHERE p.id = ?
    `,
      )
      .get(id);
    if (!purchase) return null;
    purchase.items = db
      .prepare(
        `
      SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY sort_order ASC, id ASC
    `,
      )
      .all(id);
    // Attach IMEIs (grouped by item) registered by this purchase so the edit
    // screen can re-populate the per-line IMEI inputs.
    const imeiRows = imeiRepository.getByPurchase(id);
    const byItem = new Map();
    for (const row of imeiRows) {
      if (!byItem.has(row.item_id)) byItem.set(row.item_id, []);
      byItem.get(row.item_id).push(row.imei);
    }
    purchase.items = purchase.items.map((line) => ({
      ...line,
      imeis: line.item_id ? byItem.get(line.item_id) || [] : [],
    }));
    return purchase;
  }

  getAll({ ledgerId, fromDate, toDate, search, limit } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (ledgerId) {
      conds.push("p.ledger_id = ?");
      params.push(ledgerId);
    }
    if (fromDate) {
      conds.push("p.date >= ?");
      params.push(fromDate);
    }
    if (toDate) {
      conds.push("p.date <= ?");
      params.push(toDate);
    }
    if (search && String(search).trim()) {
      const like = `%${String(search).trim()}%`;
      conds.push(`(
        p.purchase_number LIKE ? OR
        p.bill_number LIKE ? OR
        p.po_number LIKE ? OR
        l.name LIKE ? OR
        EXISTS (SELECT 1 FROM purchase_items pi WHERE pi.purchase_id = p.id AND pi.item_name LIKE ?) OR
        EXISTS (SELECT 1 FROM item_imeis iu WHERE iu.purchase_id = p.id AND iu.imei LIKE ?)
      )`);
      params.push(like, like, like, like, like, like);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const limitClause = limit ? `LIMIT ${parseInt(limit, 10)}` : "";
    return db
      .prepare(
        `
      SELECT p.*, l.name AS ledger_name
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      ${where}
      ORDER BY p.date DESC, p.id DESC
      ${limitClause}
    `,
      )
      .all(...params);
  }

  getByLedger(ledgerId) {
    const db = getDb();
    const purchases = db
      .prepare(
        `
      SELECT p.*, l.name AS ledger_name
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      WHERE p.ledger_id = ?
      ORDER BY p.date DESC, p.id DESC
    `,
      )
      .all(ledgerId);
    const itemStmt = db.prepare(`
      SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY sort_order ASC, id ASC
    `);
    return purchases.map((p) => ({ ...p, items: itemStmt.all(p.id) }));
  }

  delete(id) {
    const db = getDb();
    return db.prepare("DELETE FROM purchases WHERE id = ?").run(id);
  }

  update(
    id,
    {
      ledger_id,
      bill_number,
      po_number,
      date,
      time,
      total_amount,
      total_discount,
      bill_discount,
      freight_charge,
      total_gst,
      item_count,
      notes,
      items,
    },
  ) {
    const db = getDb();
    db.prepare(
      `
      UPDATE purchases
      SET ledger_id = ?, bill_number = ?, po_number = ?, date = ?, time = ?, total_amount = ?,
          total_discount = ?, bill_discount = ?, freight_charge = ?, total_gst = ?, item_count = ?, notes = ?
      WHERE id = ?
    `,
    ).run(
      ledger_id,
      (bill_number || "").toString().trim(),
      (po_number || "").toString().trim(),
      date,
      time || "",
      total_amount,
      total_discount || 0,
      bill_discount || 0,
      freight_charge || 0,
      total_gst || 0,
      item_count || (items ? items.length : 0),
      notes || "",
      id,
    );
    if (Array.isArray(items)) {
      db.prepare("DELETE FROM purchase_items WHERE purchase_id = ?").run(id);
      const stmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, item_id, item_name, unit, mrp, rate, sales_rate, quantity, discount_percent, gst_percent, gst_amount, amount, batch_no, batch_id, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((line, idx) => {
        stmt.run(
          id,
          line.item_id || null,
          line.item_name,
          line.unit || "Nos",
          parseFloat(line.mrp) || 0,
          parseFloat(line.rate) || 0,
          line.sales_rate != null && line.sales_rate !== ""
            ? parseFloat(line.sales_rate)
            : null,
          parseFloat(line.quantity) || 1,
          parseFloat(line.discount_percent) || 0,
          parseFloat(line.gst_percent) || 0,
          parseFloat(line.gst_amount) || 0,
          parseFloat(line.amount) || 0,
          (line.batch_no || "").toString().trim(),
          line.batch_id || null,
          idx,
        );
      });
    }
    return this.getById(id);
  }

  /**
   * GSTR-2 (inward supplies) — one row per supplier invoice + GST rate slab.
   * Mirrors saleRepository.getGstr1Report. Taxable value is derived as
   * (line amount − GST portion); tax split is applied in the service layer.
   */
  getGstr2Report({ fromDate, toDate } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (fromDate) {
      conds.push("p.date >= ?");
      params.push(fromDate);
    }
    if (toDate) {
      conds.push("p.date <= ?");
      params.push(toDate);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    return db
      .prepare(
        `
      SELECT
        p.id                                                     AS purchase_id,
        COALESCE(NULLIF(TRIM(p.bill_number), ''), p.purchase_number) AS invoice_no,
        p.date                                                   AS date,
        l.name                                                   AS party_name,
        COALESCE(l.gst_no, '')                                   AS party_gstin,
        COALESCE(l.state_code, '')                               AS state_code,
        COALESCE(l.igst_status, 'NO')                            AS igst_status,
        COALESCE(pi.gst_percent, 0)                              AS gst_rate,
        COALESCE(SUM(pi.amount - pi.gst_amount), 0)              AS taxable_value,
        COALESCE(SUM(pi.gst_amount), 0)                          AS gst_amount,
        COALESCE(SUM(pi.amount), 0)                              AS total_value
      FROM purchases p
      JOIN ledgers l ON l.id = p.ledger_id
      JOIN purchase_items pi ON pi.purchase_id = p.id
      ${where}
      GROUP BY p.id, pi.gst_percent
      ORDER BY p.date ASC, p.id ASC, pi.gst_percent ASC
    `,
      )
      .all(...params);
  }
}

module.exports = new PurchaseRepository();
