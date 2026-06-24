import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import ServiceItemSelect from './ServiceItemSelect';

/**
 * Shared detail fields for the service entry and service-closing screens.
 *
 * Props:
 *   form        — { date, item:{id,name}|null, quantity, imei, staff_id,
 *                   advance_amount, customer_name, customer_mobile,
 *                   customer_place, remarks }
 *   setForm     — state setter (receives updater fn)
 *   ledger      — selected ledger object
 *   setLedger   — ledger setter
 *   items       — saved items master list
 *   staffs      — staff master list
 */
export default function ServiceFormFields({ form, setForm, ledger, setLedger, items, staffs }) {
  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));
  const isCash = ledger?.name === 'CASH';

  return (
    <div className="space-y-5">
      {/* Ledger + date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Customer Ledger</label>
          <LedgerAutocomplete
            value={ledger}
            onChange={setLedger}
            behaviour="customer"
            placeholder="Search customer ledger…"
          />
          <p className="text-[11px] text-slate-400 mt-1">Defaults to CASH for walk-in customers.</p>
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => patch({ date: e.target.value })}
            className="input-field"
          />
        </div>
      </div>

      {/* Item + qty + imei */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
        <div className="sm:col-span-6">
          <label className="label">Item</label>
          <ServiceItemSelect
            items={items}
            value={form.item}
            onChange={(item) => patch({ item })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Qty</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={form.quantity}
            onChange={(e) => patch({ quantity: e.target.value })}
            className="input-field text-right"
            placeholder="1"
          />
        </div>
        <div className="sm:col-span-4">
          <label className="label">IMEI / Serial No.</label>
          <input
            type="text"
            value={form.imei}
            onChange={(e) => patch({ imei: e.target.value })}
            className="input-field"
            placeholder="Device IMEI / serial"
          />
        </div>
      </div>

      {/* Serviced by + advance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Serviced By</label>
          <select
            value={form.staff_id}
            onChange={(e) => patch({ staff_id: e.target.value })}
            className="input-field"
          >
            <option value="">— Select staff —</option>
            {staffs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Advance Received (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.advance_amount}
            onChange={(e) => patch({ advance_amount: e.target.value })}
            className="input-field text-right"
            placeholder="0"
          />
        </div>
      </div>

      {/* Customer details */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Customer Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => patch({ customer_name: e.target.value })}
              className="input-field"
              placeholder="Customer name"
            />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              type="tel"
              value={form.customer_mobile}
              onChange={(e) => patch({ customer_mobile: e.target.value.replace(/[^0-9]/g, '') })}
              className="input-field"
              placeholder="Mobile number"
              maxLength={10}
            />
          </div>
          <div>
            <label className="label">Place</label>
            <input
              type="text"
              value={form.customer_place}
              onChange={(e) => patch({ customer_place: e.target.value })}
              className="input-field"
              placeholder="Place"
            />
          </div>
        </div>
        {isCash && (
          <p className="text-[11px] text-slate-400 mt-1">Capture walk-in customer details for CASH services.</p>
        )}
      </div>

      {/* Remarks */}
      <div>
        <label className="label">Service Remarks</label>
        <textarea
          value={form.remarks}
          onChange={(e) => patch({ remarks: e.target.value })}
          rows={2}
          className="input-field resize-none"
          placeholder="Problem reported / notes about the service"
        />
      </div>
    </div>
  );
}
