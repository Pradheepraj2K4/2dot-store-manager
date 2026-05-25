const purchaseReturnRepository = require('../repositories/purchaseReturnRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const itemRepository = require('../repositories/itemRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const { AppError } = require('../middleware/errorHandler');
const { getDb } = require('../db/database');

/**
 * Purchase-return service.
 *
 * Recording a supplier return:
 *   • stock-out: every linked item's on-hand stock goes DOWN
 *   • ledger balance is NOT affected (mirrors purchases — supplier ledger
 *     stays informational)
 */
function computeLineAmounts(line) {
  const rate = parseFloat(line.rate) || 0;
  const qty  = parseFloat(line.quantity) || 1;
  const disc = parseFloat(line.discount_percent) || 0;
  const gst  = parseFloat(line.gst_percent) || 0;
  const taxable    = rate * qty * (1 - disc / 100);
  const gst_amount = Math.round(taxable * gst / 100 * 100) / 100;
  const amount     = Math.round((taxable + gst_amount) * 100) / 100;
  return { gst_amount, amount };
}

function applyStockDelta(items, sign) {
  for (const line of items || []) {
    if (!line.item_id) continue;
    const qty = parseFloat(line.quantity) || 0;
    if (!qty) continue;
    itemRepository.adjustStock(line.item_id, sign * qty);
  }
}

class PurchaseReturnService {
  validate(data) {
    if (!data) throw new AppError('Invalid payload', 400);
    if (!data.ledger_id) throw new AppError('Supplier ledger is required', 400);
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new AppError('At least one item line is required', 400);
    }
    data.items.forEach((line, idx) => {
      if (!line.item_name || !String(line.item_name).trim()) {
        throw new AppError(`Row ${idx + 1}: item name is required`, 400);
      }
      const rate = parseFloat(line.rate);
      if (isNaN(rate) || rate < 0) {
        throw new AppError(`Row ${idx + 1}: rate must be a non-negative number`, 400);
      }
      const qty = parseFloat(line.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new AppError(`Row ${idx + 1}: quantity must be greater than zero`, 400);
      }
    });
  }

  _normalise(items) {
    return items.map((line) => {
      const { gst_amount, amount } = computeLineAmounts(line);
      return {
        ...line,
        quantity: parseFloat(line.quantity) || 1,
        rate: parseFloat(line.rate) || 0,
        mrp: parseFloat(line.mrp) || 0,
        discount_percent: parseFloat(line.discount_percent) || 0,
        gst_percent: parseFloat(line.gst_percent) || 0,
        gst_amount,
        amount,
      };
    });
  }

  _totals(items) {
    const total_amount = items.reduce((s, l) => s + l.amount, 0);
    const total_gst    = items.reduce((s, l) => s + l.gst_amount, 0);
    const total_discount = items.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const taxable = gross * (1 - (parseFloat(l.discount_percent) || 0) / 100);
      return s + (gross - taxable);
    }, 0);
    return {
      total_amount:   Math.round(total_amount * 100) / 100,
      total_gst:      Math.round(total_gst * 100) / 100,
      total_discount: Math.round(total_discount * 100) / 100,
    };
  }

  create(data) {
    this.validate(data);
    const db = getDb();
    const ledger = ledgerRepository.findById(data.ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);
    if (ledger.status === 'closed') throw new AppError('Cannot record return on a closed ledger', 400);

    if (data.purchase_id) {
      const purchase = purchaseRepository.getById(data.purchase_id);
      if (!purchase) throw new AppError('Linked purchase not found', 404);
    }

    const normalisedItems = this._normalise(data.items);
    const totals = this._totals(normalisedItems);

    const run = db.transaction(() => {
      const ret = purchaseReturnRepository.create({
        return_number: purchaseReturnRepository.getNextNumber(),
        ledger_id: parseInt(data.ledger_id),
        purchase_id: data.purchase_id ? parseInt(data.purchase_id) : null,
        bill_number: data.bill_number || '',
        date: data.date || new Date().toISOString().split('T')[0],
        time: data.time || '',
        reason: data.reason || '',
        ...totals,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        items: normalisedItems,
      });

      // Stock-out: reverse the original stock-in
      applyStockDelta(normalisedItems, -1);
      return ret;
    });
    return run();
  }

  update(id, data) {
    this.validate(data);
    const db = getDb();
    const existing = purchaseReturnRepository.getById(id);
    if (!existing) throw new AppError('Purchase return not found', 404);
    const ledger = ledgerRepository.findById(data.ledger_id || existing.ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);

    const normalisedItems = this._normalise(data.items);
    const totals = this._totals(normalisedItems);

    const run = db.transaction(() => {
      // Undo the prior stock-out, then apply the new one
      applyStockDelta(existing.items, +1);
      applyStockDelta(normalisedItems, -1);

      return purchaseReturnRepository.update(id, {
        ledger_id: ledger.id,
        purchase_id: data.purchase_id ? parseInt(data.purchase_id) : existing.purchase_id,
        bill_number: data.bill_number || '',
        date: data.date || existing.date,
        time: data.time != null ? data.time : existing.time,
        reason: data.reason || '',
        ...totals,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        items: normalisedItems,
      });
    });
    return run();
  }

  delete(id) {
    const db = getDb();
    const existing = purchaseReturnRepository.getById(id);
    if (!existing) throw new AppError('Purchase return not found', 404);
    const run = db.transaction(() => {
      // Reverse the stock-out — items come back into stock
      applyStockDelta(existing.items, +1);
      purchaseReturnRepository.delete(id);
    });
    run();
  }

  getById(id) {
    const ret = purchaseReturnRepository.getById(id);
    if (!ret) throw new AppError('Purchase return not found', 404);
    return ret;
  }

  getAll(filters) {
    return purchaseReturnRepository.getAll(filters);
  }

  getByLedger(ledgerId) {
    return purchaseReturnRepository.getByLedger(ledgerId);
  }

  getNextNumber() {
    return purchaseReturnRepository.getNextNumber();
  }
}

module.exports = new PurchaseReturnService();
