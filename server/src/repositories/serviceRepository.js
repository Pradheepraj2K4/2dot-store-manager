const { getDb } = require('../db/database');

class ServiceRepository {
  getNextServiceNumber() {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(MAX(CAST(service_number AS INTEGER)), 0) + 1 AS next
      FROM services
    `).get();
    return String(row.next);
  }

  /** Insert the child item rows for a service. */
  _insertItems(db, serviceId, items) {
    const insert = db.prepare(`
      INSERT INTO service_items
        (service_id, item_id, item_name, quantity, imei, staff_id, staff_name, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    (items || []).forEach((it, idx) => {
      insert.run(
        serviceId,
        it.item_id || null,
        it.item_name,
        it.quantity || 1,
        it.imei || '',
        it.staff_id || null,
        it.staff_name || '',
        idx
      );
    });
  }

  /** Fetch the child item rows for a service, ordered. */
  _getItems(db, serviceId) {
    return db.prepare(`
      SELECT id, item_id, item_name, quantity, imei, staff_id, staff_name
      FROM service_items
      WHERE service_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(serviceId);
  }

  create(data) {
    const db = getDb();
    const items = data.items && data.items.length ? data.items : [{
      item_id: data.item_id || null,
      item_name: data.item_name,
      quantity: data.quantity,
      imei: data.imei || '',
      staff_id: data.staff_id || null,
      staff_name: data.staff_name || '',
    }];
    // Keep the legacy inline columns populated from the first item so existing
    // list / search screens keep working.
    const first = items[0];

    const txn = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO services (
          service_number, ledger_id, date, item_id, item_name, quantity, imei,
          staff_id, staff_name, advance_amount, customer_name, customer_mobile,
          customer_place, remarks, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.service_number,
        data.ledger_id,
        data.date,
        first.item_id || null,
        first.item_name,
        first.quantity,
        first.imei || '',
        first.staff_id || null,
        first.staff_name || '',
        data.advance_amount || 0,
        data.customer_name || '',
        data.customer_mobile || '',
        data.customer_place || '',
        data.remarks || '',
        'pending'
      );
      this._insertItems(db, info.lastInsertRowid, items);
      return info.lastInsertRowid;
    });

    return this.getById(txn());
  }

  getById(id) {
    const db = getDb();
    const service = db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM services s
      JOIN ledgers l ON l.id = s.ledger_id
      WHERE s.id = ?
    `).get(id);
    if (service) service.items = this._getItems(db, id);
    return service;
  }

  getAll({ status, ledgerId, fromDate, toDate } = {}) {
    const db = getDb();
    const conds = [];
    const params = [];
    if (status)   { conds.push('s.status = ?');    params.push(status); }
    if (ledgerId) { conds.push('s.ledger_id = ?'); params.push(ledgerId); }
    if (fromDate) { conds.push('s.date >= ?');     params.push(fromDate); }
    if (toDate)   { conds.push('s.date <= ?');     params.push(toDate); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM services s
      JOIN ledgers l ON l.id = s.ledger_id
      ${where}
      ORDER BY s.date DESC, s.id DESC
    `).all(...params);
    for (const r of rows) r.items = this._getItems(db, r.id);
    return rows;
  }

  /** Update the editable detail fields of a service (does not change status). */
  updateDetails(id, data) {
    const db = getDb();
    const items = data.items && data.items.length ? data.items : [{
      item_id: data.item_id || null,
      item_name: data.item_name,
      quantity: data.quantity,
      imei: data.imei || '',
      staff_id: data.staff_id || null,
      staff_name: data.staff_name || '',
    }];
    const first = items[0];

    const txn = db.transaction(() => {
      db.prepare(`
        UPDATE services
        SET ledger_id = ?, date = ?, item_id = ?, item_name = ?, quantity = ?, imei = ?,
            staff_id = ?, staff_name = ?, advance_amount = ?,
            customer_name = ?, customer_mobile = ?, customer_place = ?, remarks = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        data.ledger_id,
        data.date,
        first.item_id || null,
        first.item_name,
        first.quantity,
        first.imei || '',
        first.staff_id || null,
        first.staff_name || '',
        data.advance_amount || 0,
        data.customer_name || '',
        data.customer_mobile || '',
        data.customer_place || '',
        data.remarks || '',
        id
      );
      db.prepare('DELETE FROM service_items WHERE service_id = ?').run(id);
      this._insertItems(db, id, items);
    });
    txn();
    return this.getById(id);
  }

  /** Mark a service as closed, storing the closing costs and amount to collect. */
  close(id, { material_cost, labour_cost, collect_amount, closing_remarks }) {
    const db = getDb();
    db.prepare(`
      UPDATE services
      SET status = 'closed', material_cost = ?, labour_cost = ?, collect_amount = ?,
          closing_remarks = ?, closed_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(material_cost, labour_cost, collect_amount, closing_remarks || '', id);
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM service_items WHERE service_id = ?').run(id);
    return db.prepare('DELETE FROM services WHERE id = ?').run(id);
  }
}

module.exports = new ServiceRepository();
