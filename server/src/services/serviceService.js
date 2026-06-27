const serviceRepository = require('../repositories/serviceRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const staffRepository = require('../repositories/staffRepository');
const { AppError } = require('../middleware/errorHandler');

function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

/** Validate and normalise the editable detail fields shared by create/update. */
function normaliseDetails(data) {
  if (!data) throw new AppError('Invalid payload', 400);
  if (!data.ledger_id) throw new AppError('Customer ledger is required', 400);

  const ledger = ledgerRepository.findById(parseInt(data.ledger_id));
  if (!ledger) throw new AppError('Ledger not found', 404);

  // Resolve a staff member (id -> {id, name}); returns nulls when none given.
  const resolveStaff = (staffId, staffName) => {
    if (staffId) {
      const staff = staffRepository.getById(parseInt(staffId));
      if (!staff) throw new AppError('Staff not found', 404);
      return { staff_id: staff.id, staff_name: staff.name };
    }
    return { staff_id: null, staff_name: (staffName ? String(staffName) : '').trim() };
  };

  // Build the items array. Accepts a multi-row `items` payload or falls back to
  // the legacy single-item fields for backward compatibility.
  const rawItems = Array.isArray(data.items) && data.items.length
    ? data.items
    : [{
        item_id: data.item_id,
        item_name: data.item_name,
        quantity: data.quantity,
        imei: data.imei,
        staff_id: data.staff_id,
        staff_name: data.staff_name,
      }];

  const items = rawItems
    .map((it) => {
      const item_name = (it.item_name ? String(it.item_name) : '').trim();
      if (!item_name) return null;
      const quantity = parseFloat(it.quantity);
      const staff = resolveStaff(it.staff_id, it.staff_name);
      return {
        item_id: it.item_id ? parseInt(it.item_id) : null,
        item_name,
        quantity: !quantity || quantity <= 0 ? 1 : quantity,
        imei: (it.imei ? String(it.imei) : '').trim(),
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
      };
    })
    .filter(Boolean);

  if (items.length === 0) throw new AppError('At least one item is required', 400);

  const first = items[0];
  return {
    ledger_id: ledger.id,
    date: data.date || new Date().toISOString().split('T')[0],
    items,
    // Legacy summary fields (mirror the first item) kept for list/search screens.
    item_id: first.item_id,
    item_name: first.item_name,
    quantity: first.quantity,
    imei: first.imei,
    staff_id: first.staff_id,
    staff_name: first.staff_name,
    advance_amount: round2(data.advance_amount),
    customer_name: (data.customer_name ? String(data.customer_name) : '').trim(),
    customer_mobile: (data.customer_mobile ? String(data.customer_mobile) : '').trim(),
    customer_place: (data.customer_place ? String(data.customer_place) : '').trim(),
    remarks: (data.remarks ? String(data.remarks) : '').trim(),
  };
}

class ServiceService {
  getAll(filters) {
    return serviceRepository.getAll(filters);
  }

  getById(id) {
    const service = serviceRepository.getById(id);
    if (!service) throw new AppError('Service not found', 404);
    return service;
  }

  getNextServiceNumber() {
    return serviceRepository.getNextServiceNumber();
  }

  create(data) {
    const details = normaliseDetails(data);
    const service_number = serviceRepository.getNextServiceNumber();
    return serviceRepository.create({ ...details, service_number });
  }

  /** Update the detail fields of a still-open service. */
  update(id, data) {
    const existing = this.getById(id);
    if (existing.status === 'closed') {
      throw new AppError('A closed service can no longer be edited', 400);
    }
    const details = normaliseDetails(data);
    return serviceRepository.updateDetails(id, details);
  }

  /**
   * Close a service. Optionally accepts updated detail fields (the closing
   * screen lets the operator amend the service before closing). The amount to
   * collect is material_cost + labour_cost - advance_amount.
   */
  close(id, data) {
    const existing = this.getById(id);
    if (existing.status === 'closed') {
      throw new AppError('Service is already closed', 400);
    }

    // Allow the closing screen to amend the detail fields in the same call.
    const details = normaliseDetails({ ...existing, ...data });
    serviceRepository.updateDetails(id, details);

    const material_cost = round2(data.material_cost);
    const labour_cost = round2(data.labour_cost);
    if (material_cost < 0 || labour_cost < 0) {
      throw new AppError('Costs cannot be negative', 400);
    }
    const collect_amount = round2(material_cost + labour_cost - details.advance_amount);
    return serviceRepository.close(id, {
      material_cost,
      labour_cost,
      collect_amount,
      closing_remarks: (data.closing_remarks ? String(data.closing_remarks) : '').trim(),
    });
  }

  delete(id) {
    this.getById(id);
    return serviceRepository.delete(id);
  }
}

module.exports = new ServiceService();
