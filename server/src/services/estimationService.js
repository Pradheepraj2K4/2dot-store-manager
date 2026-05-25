const estimationRepository = require('../repositories/estimationRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const saleService = require('./saleService');
const { AppError } = require('../middleware/errorHandler');
const { getDb } = require('../db/database');

/**
 * Estimation service.
 *
 * Estimations (quotations / pro-forma) carry the same line-item shape as
 * sales but are NON-POSTING: they do not adjust stock or ledger balances.
 * Either an existing ledger or a free-text customer name is required.
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

class EstimationService {
  validate(data) {
    if (!data) throw new AppError('Invalid payload', 400);
    const hasLedger = !!data.ledger_id;
    const hasName = data.customer_name && String(data.customer_name).trim();
    if (!hasLedger && !hasName) {
      throw new AppError('Select a ledger or enter a customer name', 400);
    }
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
      total_amount: Math.round(total_amount * 100) / 100,
      total_gst:    Math.round(total_gst * 100) / 100,
      total_discount: Math.round(total_discount * 100) / 100,
    };
  }

  create(data) {
    this.validate(data);
    if (data.ledger_id) {
      const ledger = ledgerRepository.findById(data.ledger_id);
      if (!ledger) throw new AppError('Ledger not found', 404);
    }
    const normalisedItems = this._normalise(data.items);
    const totals = this._totals(normalisedItems);
    return estimationRepository.create({
      estimation_number: estimationRepository.getNextNumber(),
      ledger_id: data.ledger_id ? parseInt(data.ledger_id) : null,
      customer_name: data.customer_name || '',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '',
      valid_until: data.valid_until || '',
      ...totals,
      item_count: normalisedItems.length,
      notes: data.notes || '',
      items: normalisedItems,
    });
  }

  update(id, data) {
    this.validate(data);
    const existing = estimationRepository.getById(id);
    if (!existing) throw new AppError('Estimation not found', 404);
    if (existing.status === 'converted') {
      throw new AppError('Cannot edit a converted estimation', 400);
    }
    if (data.ledger_id) {
      const ledger = ledgerRepository.findById(data.ledger_id);
      if (!ledger) throw new AppError('Ledger not found', 404);
    }
    const normalisedItems = this._normalise(data.items);
    const totals = this._totals(normalisedItems);
    return estimationRepository.update(id, {
      ledger_id: data.ledger_id ? parseInt(data.ledger_id) : null,
      customer_name: data.customer_name || '',
      date: data.date || existing.date,
      time: data.time != null ? data.time : existing.time,
      valid_until: data.valid_until || '',
      ...totals,
      item_count: normalisedItems.length,
      notes: data.notes || '',
      items: normalisedItems,
    });
  }

  delete(id) {
    const existing = estimationRepository.getById(id);
    if (!existing) throw new AppError('Estimation not found', 404);
    estimationRepository.delete(id);
  }

  getById(id) {
    const est = estimationRepository.getById(id);
    if (!est) throw new AppError('Estimation not found', 404);
    return est;
  }

  getAll(filters) {
    return estimationRepository.getAll(filters);
  }

  getNextNumber() {
    return estimationRepository.getNextNumber();
  }

  /**
   * Convert an open estimation into a real sale. Requires the estimation
   * to have a linked ledger (we don't auto-create ledgers).
   */
  convertToSale(id) {
    const db = getDb();
    const estimation = estimationRepository.getById(id);
    if (!estimation) throw new AppError('Estimation not found', 404);
    if (estimation.status === 'converted') {
      throw new AppError('Estimation has already been converted', 400);
    }
    if (!estimation.ledger_id) {
      throw new AppError('Link a ledger before converting to a sale', 400);
    }

    const run = db.transaction(() => {
      const sale = saleService.create({
        ledger_id: estimation.ledger_id,
        date: new Date().toISOString().split('T')[0],
        notes: `Converted from Estimation #${estimation.estimation_number}`,
        items: estimation.items.map((l) => ({
          item_id: l.item_id,
          item_name: l.item_name,
          unit: l.unit,
          mrp: l.mrp,
          rate: l.rate,
          quantity: l.quantity,
          discount_percent: l.discount_percent,
          gst_percent: l.gst_percent,
        })),
      });
      estimationRepository.markConverted(id, sale.id);
      return sale;
    });
    return run();
  }
}

module.exports = new EstimationService();
