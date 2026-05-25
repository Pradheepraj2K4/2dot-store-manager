const salesReturnRepository = require('../repositories/salesReturnRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const itemRepository = require('../repositories/itemRepository');
const saleRepository = require('../repositories/saleRepository');
const { AppError } = require('../middleware/errorHandler');
const { getDb } = require('../db/database');

/**
 * Sales-return service.
 *
 * Recording a customer return:
 *   • restores stock (+qty per linked item)
 *   • reverses the customer's outstanding balance — for customer-behaviour
 *     ledgers the receivable goes DOWN; for supplier-behaviour ledgers
 *     (rare in this flow) the payable goes UP.
 *
 * Sale linkage is optional — for ad-hoc returns the user can record the
 * goods without a parent sale reference.
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

/** Same convention as saleService: positive delta means receivable grows. */
function applyLedgerDelta(behaviour, delta) {
  return behaviour === 'customer' ? delta : -delta;
}

class SalesReturnService {
  validate(data) {
    if (!data) throw new AppError('Invalid payload', 400);
    if (!data.ledger_id) throw new AppError('Customer ledger is required', 400);
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

    if (data.sale_id) {
      const sale = saleRepository.getById(data.sale_id);
      if (!sale) throw new AppError('Linked sale not found', 404);
    }

    const normalisedItems = this._normalise(data.items);
    const totals = this._totals(normalisedItems);

    const run = db.transaction(() => {
      const ret = salesReturnRepository.create({
        return_number: salesReturnRepository.getNextNumber(),
        ledger_id: parseInt(data.ledger_id),
        sale_id: data.sale_id ? parseInt(data.sale_id) : null,
        date: data.date || new Date().toISOString().split('T')[0],
        time: data.time || '',
        reason: data.reason || '',
        ...totals,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        items: normalisedItems,
      });

      // Reverse the receivable by the return total
      const delta = applyLedgerDelta(ledger.behaviour, totals.total_amount);
      ledgerRepository.updateBalance(ledger.id, ledger.current_balance - delta);

      // Stock back into inventory
      applyStockDelta(normalisedItems, +1);
      return ret;
    });
    return run();
  }

  update(id, data) {
    this.validate(data);
    const db = getDb();
    const existing = salesReturnRepository.getById(id);
    if (!existing) throw new AppError('Sales return not found', 404);
    const ledger = ledgerRepository.findById(existing.ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);

    const normalisedItems = this._normalise(data.items);
    const totals = this._totals(normalisedItems);

    const run = db.transaction(() => {
      // Reverse the previous ledger / stock effect, then apply the new one
      const oldDelta = applyLedgerDelta(ledger.behaviour, existing.total_amount);
      const newDelta = applyLedgerDelta(ledger.behaviour, totals.total_amount);
      ledgerRepository.updateBalance(ledger.id, ledger.current_balance + oldDelta - newDelta);

      applyStockDelta(existing.items, -1);
      applyStockDelta(normalisedItems, +1);

      return salesReturnRepository.update(id, {
        ledger_id: ledger.id,
        sale_id: data.sale_id ? parseInt(data.sale_id) : existing.sale_id,
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
    const existing = salesReturnRepository.getById(id);
    if (!existing) throw new AppError('Sales return not found', 404);
    const ledger = ledgerRepository.findById(existing.ledger_id);
    const run = db.transaction(() => {
      if (ledger) {
        const oldDelta = applyLedgerDelta(ledger.behaviour, existing.total_amount);
        ledgerRepository.updateBalance(ledger.id, ledger.current_balance + oldDelta);
      }
      // Roll the stock back out
      applyStockDelta(existing.items, -1);
      salesReturnRepository.delete(id);
    });
    run();
  }

  getById(id) {
    const ret = salesReturnRepository.getById(id);
    if (!ret) throw new AppError('Sales return not found', 404);
    return ret;
  }

  getAll(filters) {
    return salesReturnRepository.getAll(filters);
  }

  getByLedger(ledgerId) {
    return salesReturnRepository.getByLedger(ledgerId);
  }

  getNextNumber() {
    return salesReturnRepository.getNextNumber();
  }
}

module.exports = new SalesReturnService();
