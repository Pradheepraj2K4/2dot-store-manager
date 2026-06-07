const { getDb } = require('../db/database');
const { AppError } = require('../middleware/errorHandler');

/**
 * IMEI / serial-number repository.
 *
 * Each IMEI is a physical unit of an item. Units enter stock through a purchase
 * (`status = 'in_stock'`) and leave through a sale (`status = 'sold'`). The
 * originating purchase and consuming sale are stored so that edits / deletes of
 * those documents can restore or remove the affected units.
 */
class ImeiRepository {
  /** All in-stock (available-to-sell) IMEIs for an item. */
  getAvailableByItem(itemId) {
    if (!itemId) return [];
    const db = getDb();
    return db.prepare(`
      SELECT id, item_id, imei, status, purchase_id, sale_id
      FROM item_imeis
      WHERE item_id = ? AND status = 'in_stock'
      ORDER BY created_at ASC, id ASC
    `).all(itemId);
  }

  /** Every IMEI ever registered for an item, regardless of status. */
  getAllByItem(itemId) {
    if (!itemId) return [];
    const db = getDb();
    return db.prepare(`
      SELECT id, item_id, imei, status, purchase_id, sale_id
      FROM item_imeis
      WHERE item_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(itemId);
  }

  /** Every IMEI registered by a given purchase. */
  getByPurchase(purchaseId) {
    if (!purchaseId) return [];
    const db = getDb();
    return db.prepare(`
      SELECT id, item_id, imei, status, purchase_id, sale_id
      FROM item_imeis
      WHERE purchase_id = ?
      ORDER BY item_id ASC, id ASC
    `).all(purchaseId);
  }

  /** Every IMEI consumed by a given sale. */
  getBySale(saleId) {
    if (!saleId) return [];
    const db = getDb();
    return db.prepare(`
      SELECT id, item_id, imei, status, purchase_id, sale_id
      FROM item_imeis
      WHERE sale_id = ?
      ORDER BY item_id ASC, id ASC
    `).all(saleId);
  }

  /** Insert a batch of fresh in-stock IMEIs for a purchase line. */
  addForPurchase(itemId, purchaseId, imeis) {
    if (!itemId || !Array.isArray(imeis) || imeis.length === 0) return;
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO item_imeis (item_id, imei, status, purchase_id)
      VALUES (?, ?, 'in_stock', ?)
    `);
    for (const raw of imeis) {
      const imei = String(raw || '').trim();
      if (!imei) continue;
      stmt.run(itemId, imei, purchaseId);
    }
  }

  /**
   * Remove the still-in-stock IMEIs registered by a purchase. IMEIs that were
   * already sold are left untouched (they cannot be un-sold by editing the
   * purchase). Returns the list of IMEI strings that could NOT be removed
   * because they are already sold.
   */
  removeInStockByPurchase(purchaseId) {
    if (!purchaseId) return [];
    const db = getDb();
    const sold = db.prepare(`
      SELECT imei FROM item_imeis WHERE purchase_id = ? AND status = 'sold'
    `).all(purchaseId).map((r) => r.imei);
    db.prepare(`
      DELETE FROM item_imeis WHERE purchase_id = ? AND status = 'in_stock'
    `).run(purchaseId);
    return sold;
  }

  /**
   * Mark the supplied IMEIs as sold for an item and link them to a sale.
   * Only flips rows that are currently in stock for that item. Throws when an
   * IMEI is missing or already sold.
   */
  markSold(itemId, saleId, imeis) {
    if (!itemId || !Array.isArray(imeis) || imeis.length === 0) return;
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE item_imeis
      SET status = 'sold', sale_id = ?, updated_at = datetime('now', 'localtime')
      WHERE item_id = ? AND imei = ? AND status = 'in_stock'
    `);
    for (const raw of imeis) {
      const imei = String(raw || '').trim();
      if (!imei) continue;
      const info = stmt.run(saleId, itemId, imei);
      if (info.changes === 0) {
        throw new AppError(`IMEI "${imei}" is not available for sale`, 400);
      }
    }
  }

  /** Restore every IMEI consumed by a sale back to in-stock. */
  restoreBySale(saleId) {
    if (!saleId) return;
    const db = getDb();
    db.prepare(`
      UPDATE item_imeis
      SET status = 'in_stock', sale_id = NULL, updated_at = datetime('now', 'localtime')
      WHERE sale_id = ?
    `).run(saleId);
  }
}

module.exports = new ImeiRepository();
