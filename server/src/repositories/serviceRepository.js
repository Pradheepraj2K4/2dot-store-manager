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

  create(data) {
    const db = getDb();
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
      data.item_id || null,
      data.item_name,
      data.quantity,
      data.imei || '',
      data.staff_id || null,
      data.staff_name || '',
      data.advance_amount || 0,
      data.customer_name || '',
      data.customer_mobile || '',
      data.customer_place || '',
      data.remarks || '',
      'pending'
    );
    return this.getById(info.lastInsertRowid);
  }

  getById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM services s
      JOIN ledgers l ON l.id = s.ledger_id
      WHERE s.id = ?
    `).get(id);
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
    return db.prepare(`
      SELECT s.*, l.name AS ledger_name
      FROM services s
      JOIN ledgers l ON l.id = s.ledger_id
      ${where}
      ORDER BY s.date DESC, s.id DESC
    `).all(...params);
  }

  /** Update the editable detail fields of a service (does not change status). */
  updateDetails(id, data) {
    const db = getDb();
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
      data.item_id || null,
      data.item_name,
      data.quantity,
      data.imei || '',
      data.staff_id || null,
      data.staff_name || '',
      data.advance_amount || 0,
      data.customer_name || '',
      data.customer_mobile || '',
      data.customer_place || '',
      data.remarks || '',
      id
    );
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
    return db.prepare('DELETE FROM services WHERE id = ?').run(id);
  }
}

module.exports = new ServiceRepository();
