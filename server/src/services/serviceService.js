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
  const item_name = (data.item_name ? String(data.item_name) : '').trim();
  if (!item_name) throw new AppError('Item is required', 400);

  const ledger = ledgerRepository.findById(parseInt(data.ledger_id));
  if (!ledger) throw new AppError('Ledger not found', 404);

  let staff_id = null;
  let staff_name = (data.staff_name ? String(data.staff_name) : '').trim();
  if (data.staff_id) {
    const staff = staffRepository.getById(parseInt(data.staff_id));
    if (!staff) throw new AppError('Staff not found', 404);
    staff_id = staff.id;
    staff_name = staff.name;
  }

  const quantity = parseFloat(data.quantity);
  return {
    ledger_id: ledger.id,
    date: data.date || new Date().toISOString().split('T')[0],
    item_id: data.item_id ? parseInt(data.item_id) : null,
    item_name,
    quantity: !quantity || quantity <= 0 ? 1 : quantity,
    imei: (data.imei ? String(data.imei) : '').trim(),
    staff_id,
    staff_name,
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
