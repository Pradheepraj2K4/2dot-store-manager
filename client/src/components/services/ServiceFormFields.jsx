import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import ServiceItemSelect from './ServiceItemSelect';

export function emptyServiceLine() {
  return { item: null, imei: '', quantity: '1', staff_id: '' };
}

/**
 * Shared detail fields for the service entry and service-closing screens.
 *
 * Props:
 *   form        — { date, advance_amount, customer_name, customer_mobile,
 *                   customer_place, remarks }
 *   setForm     — state setter (receives updater fn)
 *   lines       — [{ item:{id,name}|null, imei, quantity, staff_id }]
 *   setLines    — lines setter (receives updater fn)
 *   ledger      — selected ledger object
 *   setLedger   — ledger setter
 *   items       — saved items master list
 *   staffs      — staff master list
 *   hideLedgerDate — when true the ledger + date block is rendered by the parent
 *   fillHeight  — when true the items table grows to fill the available height
 *                 and the detail fields sit in a fixed footer card (matching the
 *                 item sales / purchase entry layout). Otherwise a compact stacked
 *                 layout is used (service-close screen).
 */
export default function ServiceFormFields({
  form, setForm, lines, setLines, ledger, setLedger, items, staffs,
  hideLedgerDate = false, fillHeight = false,
}) {
  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));
  const isCash = ledger?.name === 'CASH';

  const updateLine = (idx, p) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyServiceLine()]);
  const removeLine = (idx) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const ledgerDateBlock = !hideLedgerDate && (
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
  );

  const tableMarkup = (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-trust-blue sticky top-0 z-10">
          <th className="px-3 py-2 text-left font-semibold text-white w-12">S.no</th>
          <th className="px-3 py-2 text-left font-semibold text-white w-20">Item ID</th>
          <th className="px-3 py-2 text-left font-semibold text-white min-w-[16rem]">Item Name</th>
          <th className="px-3 py-2 text-left font-semibold text-white min-w-[10rem]">IMEI / Serial No.</th>
          <th className="px-3 py-2 text-right font-semibold text-white w-24">Qty</th>
          <th className="px-3 py-2 text-left font-semibold text-white w-44">Serviced By</th>
          <th className="px-3 py-2 w-10"></th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => (
          <tr key={idx} className="border-b border-slate-100 last:border-0">
            <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
            <td className="px-3 py-2 font-mono text-xs text-slate-600">
              {line.item?.id || '—'}
            </td>
            <td className="px-3 py-2">
              <ServiceItemSelect
                items={items}
                value={line.item}
                onChange={(item) => updateLine(idx, { item })}
              />
            </td>
            <td className="px-3 py-2">
              <input
                type="text"
                value={line.imei}
                onChange={(e) => updateLine(idx, { imei: e.target.value })}
                className="input-field"
                placeholder="Device IMEI / serial"
              />
            </td>
            <td className="px-3 py-2">
              <input
                type="number"
                min="0"
                step="0.001"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                className="input-field text-right"
                placeholder="1"
              />
            </td>
            <td className="px-3 py-2">
              <select
                value={line.staff_id}
                onChange={(e) => updateLine(idx, { staff_id: e.target.value })}
                className="input-field"
              >
                <option value="">— Select staff —</option>
                {staffs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </td>
            <td className="px-3 py-2 text-right">
              <button
                type="button"
                onClick={() => removeLine(idx)}
                disabled={lines.length <= 1}
                className="text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:text-slate-400"
                title="Remove row"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const addRowBar = (
    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={addLine}
        className="text-sm text-trust-blue hover:underline flex items-center gap-1"
      >
        <PlusIcon className="h-4 w-4" />
        Add row
      </button>
    </div>
  );

  const detailFields = (
    <>
      {/* Advance */}
      <div className="w-full sm:w-48">
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
    </>
  );

  // Full-height layout (item sales / purchase entry style): the items table is a
  // card that grows to fill the available space and the detail fields sit in a
  // fixed footer card.
  if (fillHeight) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {ledgerDateBlock && <div className="flex-shrink-0 mb-3">{ledgerDateBlock}</div>}
        <div className="card p-0 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">{tableMarkup}</div>
          {addRowBar}
        </div>
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm mt-3 p-4 space-y-5">
          {detailFields}
        </div>
      </div>
    );
  }

  // Compact stacked layout (service-close screen).
  return (
    <div className="space-y-5">
      {ledgerDateBlock}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">{tableMarkup}</div>
        {addRowBar}
      </div>
      {detailFields}
    </div>
  );
}
