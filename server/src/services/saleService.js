const saleRepository = require('../repositories/saleRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const itemRepository = require('../repositories/itemRepository');
const imeiRepository = require('../repositories/imeiRepository');
const { AppError } = require('../middleware/errorHandler');
const { getDb } = require('../db/database');

/** Apply +qty per line (use negative sign to reverse). */
function applyStockDelta(items, sign) {
  for (const line of items || []) {
    if (!line.item_id) continue;
    const qty = parseFloat(line.quantity) || 0;
    if (!qty) continue;
    itemRepository.adjustStock(line.item_id, sign * qty);
  }
}

/** Mark the IMEIs selected on each sale line as sold and link them to a sale. */
function consumeImeis(items, saleId) {
  for (const line of items || []) {
    if (!line.item_id || !Array.isArray(line.imeis)) continue;
    const clean = line.imeis.map((s) => String(s || '').trim()).filter(Boolean);
    if (clean.length === 0) continue;
    imeiRepository.markSold(line.item_id, saleId, clean);
  }
}

/**
 * Compute per-line amounts.
 *
 * Two rate treatments are supported via `line.rate_tax_mode`:
 *   'taxable'   — rate is the pre-tax value; GST is added on top.
 *                 gross = rate * qty * (1 - disc/100)
 *                 gst_amount = gross * gst_percent / 100
 *                 amount = gross + gst_amount
 *   'inclusive' — rate already includes GST (default).
 *                 gross = rate * qty * (1 - disc/100)
 *                 gst_amount = gross - gross / (1 + gst_percent/100)
 *                 amount = gross
 */
function computeLineAmounts(line) {
  const rate = parseFloat(line.rate) || 0;
  const qty  = parseFloat(line.quantity) || 1;
  const disc = parseFloat(line.discount_percent) || 0;
  const gst  = parseFloat(line.gst_percent) || 0;
  const gross = rate * qty * (1 - disc / 100);
  if (line.rate_tax_mode === 'taxable') {
    const gst_amount = Math.round(gross * gst / 100 * 100) / 100;
    const amount     = Math.round((gross + gst_amount) * 100) / 100;
    return { gst_amount, amount };
  }
  const gst_amount = Math.round((gross - gross / (1 + gst / 100)) * 100) / 100;
  const amount     = Math.round(gross * 100) / 100;
  return { gst_amount, amount };
}

/** @deprecated kept for compatibility — use computeLineAmounts */
function computeLineAmount(line) {
  return computeLineAmounts(line).amount;
}

function applyLedgerDelta(behaviour, delta) {
  // For customer ledgers: sale increases what customer owes (current_balance + delta).
  // For supplier ledgers: sale (selling TO a supplier) reduces what we owe them.
  return behaviour === 'customer' ? delta : -delta;
}

class SaleService {
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
    });
  }

  create(data) {
    this.validate(data);
    const db = getDb();
    const ledger = ledgerRepository.findById(data.ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);
    if (ledger.status === 'closed') throw new AppError('Cannot record sale on a closed ledger', 400);

    const normalisedItems = data.items.map((line) => {
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
    const total_amount = normalisedItems.reduce((s, l) => s + l.amount, 0);
    const total_gst    = normalisedItems.reduce((s, l) => s + l.gst_amount, 0);
    const total_discount = normalisedItems.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const taxable = gross * (1 - (parseFloat(l.discount_percent) || 0) / 100);
      return s + (gross - taxable);
    }, 0);

    const run = db.transaction(() => {
      const sale_number = saleRepository.getNextSaleNumber();
      const bill_discount_val = Math.round((parseFloat(data.bill_discount) || 0) * 100) / 100;
      const sale = saleRepository.create({
        sale_number,
        ledger_id: parseInt(data.ledger_id),
        date: data.date || new Date().toISOString().split('T')[0],
        time: data.time || '',
        total_amount: Math.round((total_amount - bill_discount_val) * 100) / 100,
        total_discount: Math.round(total_discount * 100) / 100,
        bill_discount: bill_discount_val,
        total_gst: Math.round(total_gst * 100) / 100,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        customer_name: data.customer_name || '',
        customer_mobile: data.customer_mobile || '',
        customer_place: data.customer_place || '',
        items: normalisedItems,
      });

      const delta = applyLedgerDelta(ledger.behaviour, total_amount - bill_discount_val);
      ledgerRepository.updateBalance(ledger.id, ledger.current_balance + delta);

      // Decrement stock for every linked item line
      applyStockDelta(normalisedItems, -1);
      // Mark any selected IMEIs as sold against this sale.
      consumeImeis(normalisedItems, sale.id);
      return sale;
    });
    return run();
  }

  update(id, data) {
    this.validate(data);
    const db = getDb();
    const existing = saleRepository.getById(id);
    if (!existing) throw new AppError('Sale not found', 404);
    const ledger = ledgerRepository.findById(existing.ledger_id);
    if (!ledger) throw new AppError('Ledger not found', 404);

    const normalisedItems = data.items.map((line) => {
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
    const total_amount = normalisedItems.reduce((s, l) => s + l.amount, 0);
    const total_gst    = normalisedItems.reduce((s, l) => s + l.gst_amount, 0);
    const total_discount = normalisedItems.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const taxable = gross * (1 - (parseFloat(l.discount_percent) || 0) / 100);
      return s + (gross - taxable);
    }, 0);

    const run = db.transaction(() => {
      // Reverse previous delta, apply new delta
      const bill_discount_val = Math.round((parseFloat(data.bill_discount) || 0) * 100) / 100;
      const net_total = Math.round((total_amount - bill_discount_val) * 100) / 100;
      const oldDelta = applyLedgerDelta(ledger.behaviour, existing.total_amount);
      const newDelta = applyLedgerDelta(ledger.behaviour, net_total);
      ledgerRepository.updateBalance(ledger.id, ledger.current_balance - oldDelta + newDelta);

      // Reverse previous stock impact, apply new
      applyStockDelta(existing.items, +1);
      applyStockDelta(normalisedItems, -1);

      // Restore the IMEIs the previous version of this sale consumed, then
      // mark the newly selected ones as sold.
      imeiRepository.restoreBySale(id);

      const updated = saleRepository.update(id, {
        date: data.date || existing.date,
        time: data.time != null ? data.time : existing.time,
        total_amount: Math.round((total_amount - bill_discount_val) * 100) / 100,
        total_discount: Math.round(total_discount * 100) / 100,
        bill_discount: bill_discount_val,
        total_gst: Math.round(total_gst * 100) / 100,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        customer_name: data.customer_name || '',
        customer_mobile: data.customer_mobile || '',
        customer_place: data.customer_place || '',
        items: normalisedItems,
      });
      consumeImeis(normalisedItems, id);
      return updated;
    });
    return run();
  }

  delete(id) {
    const db = getDb();
    const existing = saleRepository.getById(id);
    if (!existing) throw new AppError('Sale not found', 404);
    const ledger = ledgerRepository.findById(existing.ledger_id);
    const run = db.transaction(() => {
      if (ledger) {
        const oldDelta = applyLedgerDelta(ledger.behaviour, existing.total_amount);
        ledgerRepository.updateBalance(ledger.id, ledger.current_balance - oldDelta);
      }
      // Restore stock back to inventory
      applyStockDelta(existing.items, +1);
      // Return any consumed IMEIs to in-stock.
      imeiRepository.restoreBySale(id);
      saleRepository.delete(id);
    });
    run();
  }

  getById(id) {
    const sale = saleRepository.getById(id);
    if (!sale) throw new AppError('Sale not found', 404);
    return sale;
  }

  getAll(filters) {
    return saleRepository.getAll(filters);
  }

  getByLedger(ledgerId) {
    return saleRepository.getByLedger(ledgerId);
  }

  getNextSaleNumber() {
    return saleRepository.getNextSaleNumber();
  }
}

module.exports = new SaleService();
