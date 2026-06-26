const customerRepository = require('../repositories/customerRepository');
const { AppError } = require('../middleware/errorHandler');

function cleanMobile(mobile) {
  return String(mobile || '').replace(/\D/g, '').slice(0, 10);
}

class CustomerService {
  getAll(filters) {
    return customerRepository.getAll(filters);
  }

  getById(id) {
    const customer = customerRepository.getById(id);
    if (!customer) throw new AppError('Customer not found', 404);
    return customer;
  }

  normalise(data) {
    const name = (data && data.name ? String(data.name) : '').trim();
    const mobile = cleanMobile(data && data.mobile);
    if (!name) throw new AppError('Customer name is required', 400);
    if (mobile && mobile.length !== 10) {
      throw new AppError('Mobile number must be exactly 10 digits', 400);
    }
    return {
      name,
      mobile,
      place: (data.place ? String(data.place) : '').trim(),
      address: (data.address ? String(data.address) : '').trim(),
      email: (data.email ? String(data.email) : '').trim(),
      notes: (data.notes ? String(data.notes) : '').trim(),
    };
  }

  create(data) {
    const payload = this.normalise(data);
    // Mobile is the de-dup key — block obvious duplicates with a clear message.
    if (payload.mobile) {
      const existing = customerRepository.findByMobile(payload.mobile);
      if (existing) throw new AppError('A customer with this mobile already exists', 409);
    }
    return customerRepository.create(payload);
  }

  update(id, data) {
    this.getById(id);
    const payload = this.normalise(data);
    if (payload.mobile) {
      const existing = customerRepository.findByMobile(payload.mobile);
      if (existing && existing.id !== id) {
        throw new AppError('A customer with this mobile already exists', 409);
      }
    }
    const status = data.status === 'inactive' ? 'inactive' : 'active';
    return customerRepository.update(id, { ...payload, status });
  }

  delete(id) {
    this.getById(id);
    if (customerRepository.countSales(id) > 0) {
      throw new AppError('Cannot delete a customer linked to sales', 400);
    }
    return customerRepository.delete(id);
  }

  /**
   * Resolve a customer for a sale without the user explicitly choosing
   * "new" vs "existing". The 10-digit mobile is the natural key:
   *   • valid mobile that matches → reuse it (refresh name/place if provided)
   *   • valid mobile with no match → create a new customer
   *   • no/invalid mobile         → return null (nothing retained)
   *
   * Returns the customer id, or null.
   */
  resolveForSale({ customer_id, customer_name, customer_mobile, customer_place }) {
    if (customer_id) {
      const byId = customerRepository.getById(customer_id);
      if (byId) return byId.id;
    }
    const mobile = cleanMobile(customer_mobile);
    if (mobile.length !== 10) return null;
    const name = (customer_name ? String(customer_name) : '').trim() || 'Customer';
    const place = (customer_place ? String(customer_place) : '').trim();
    const existing = customerRepository.findByMobile(mobile);
    if (existing) {
      // Keep the directory fresh with the latest name/place from the sale.
      const nextName = name && name !== 'Customer' ? name : existing.name;
      const nextPlace = place || existing.place;
      if (nextName !== existing.name || nextPlace !== existing.place) {
        customerRepository.update(existing.id, {
          name: nextName,
          mobile,
          place: nextPlace,
          address: existing.address,
          email: existing.email,
          notes: existing.notes,
          status: existing.status,
        });
      }
      return existing.id;
    }
    const created = customerRepository.create({ name, mobile, place });
    return created.id;
  }
}

module.exports = new CustomerService();
