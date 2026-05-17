const saleRepository = require('../repositories/saleRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const { AppError } = require('../middleware/errorHandler');
const { getDb } = require('../db/database');

/**
 * Compute the line amount: (rate * quantity) less the discount %.
 */
function computeLineAmount(line) {
  const rate = parseFloat(line.rate) || 0;
  const qty = parseFloat(line.quantity) || 1;
  const disc = parseFloat(line.discount_percent) || 0;
  const gross = rate * qty;
  const net = gross * (1 - disc / 100);
  return Math.round(net * 100) / 100;
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

    const normalisedItems = data.items.map((line) => ({
      ...line,
      quantity: parseFloat(line.quantity) || 1,
      rate: parseFloat(line.rate) || 0,
      mrp: parseFloat(line.mrp) || 0,
      discount_percent: parseFloat(line.discount_percent) || 0,
      amount: computeLineAmount(line),
    }));
    const total_amount = normalisedItems.reduce((s, l) => s + l.amount, 0);
    const total_discount = normalisedItems.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      return s + (gross - l.amount);
    }, 0);

    const run = db.transaction(() => {
      const sale_number = saleRepository.getNextSaleNumber();
      const sale = saleRepository.create({
        sale_number,
        ledger_id: parseInt(data.ledger_id),
        date: data.date || new Date().toISOString().split('T')[0],
        time: data.time || '',
        total_amount: Math.round(total_amount * 100) / 100,
        total_discount: Math.round(total_discount * 100) / 100,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        items: normalisedItems,
      });

      const delta = applyLedgerDelta(ledger.behaviour, total_amount);
      ledgerRepository.updateBalance(ledger.id, ledger.current_balance + delta);
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

    const normalisedItems = data.items.map((line) => ({
      ...line,
      quantity: parseFloat(line.quantity) || 1,
      rate: parseFloat(line.rate) || 0,
      mrp: parseFloat(line.mrp) || 0,
      discount_percent: parseFloat(line.discount_percent) || 0,
      amount: computeLineAmount(line),
    }));
    const total_amount = normalisedItems.reduce((s, l) => s + l.amount, 0);
    const total_discount = normalisedItems.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      return s + (gross - l.amount);
    }, 0);

    const run = db.transaction(() => {
      // Reverse previous delta, apply new delta
      const oldDelta = applyLedgerDelta(ledger.behaviour, existing.total_amount);
      const newDelta = applyLedgerDelta(ledger.behaviour, total_amount);
      ledgerRepository.updateBalance(ledger.id, ledger.current_balance - oldDelta + newDelta);

      return saleRepository.update(id, {
        date: data.date || existing.date,
        time: data.time != null ? data.time : existing.time,
        total_amount: Math.round(total_amount * 100) / 100,
        total_discount: Math.round(total_discount * 100) / 100,
        item_count: normalisedItems.length,
        notes: data.notes || '',
        items: normalisedItems,
      });
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
