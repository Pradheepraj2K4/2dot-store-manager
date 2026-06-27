import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, WrenchScrewdriverIcon, PlusIcon } from '@heroicons/react/24/outline';
import { itemApi, staffApi, serviceApi, ledgerApi } from '../../api';
import { todayISO, formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import ServiceFormFields, { emptyServiceLine } from './ServiceFormFields';

function emptyForm() {
  return {
    date: todayISO(),
    advance_amount: '',
    customer_name: '',
    customer_mobile: '',
    customer_place: '',
    remarks: '',
  };
}

export default function ServiceEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [lines, setLines] = useState([emptyServiceLine()]);
  const [serviceNumber, setServiceNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, staffsRes] = await Promise.all([
          itemApi.getAll().catch(() => ({ data: [] })),
          staffApi.getAll().catch(() => ({ data: [] })),
        ]);
        setItems(itemsRes.data || []);
        setStaffs(staffsRes.data || []);
        serviceApi.getNextNumber().then((r) => setServiceNumber(r.data?.service_number || '')).catch(() => {});
        ledgerApi.getCash().then((r) => { if (r.data) setLedger(r.data); }).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!ledger) return toast.error('Select a customer ledger');
    const validLines = lines.filter((l) => l.item && l.item.id);
    if (validLines.length === 0) return toast.error('Add at least one item');
    if (form.customer_mobile && form.customer_mobile.length !== 10) {
      return toast.error('Customer mobile must be exactly 10 digits');
    }
    try {
      setSaving(true);
      await serviceApi.create({
        ledger_id: ledger.id,
        date: form.date,
        items: validLines.map((l) => ({
          item_id: l.item.id,
          item_name: l.item.name,
          quantity: parseFloat(l.quantity) || 1,
          imei: l.imei,
          staff_id: l.staff_id || null,
        })),
        advance_amount: parseFloat(form.advance_amount) || 0,
        customer_name: form.customer_name,
        customer_mobile: form.customer_mobile,
        customer_place: form.customer_place,
        remarks: form.remarks,
      });
      toast.success('Service recorded');
      navigate('/services/pending');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  const balance = parseFloat(ledger?.current_balance) || 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-5 w-5 text-trust-blue" />
              New Service Entry
            </h1>
            <p className="text-sm text-slate-500">Service {serviceNumber || '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-56">
            <label className="text-xs text-slate-500">Customer / Ledger *</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Create new ledger"
                onClick={() => navigate('/ledger-creation?returnTo=' + encodeURIComponent(location.pathname + location.search))}
                className="flex h-9 w-7 shrink-0 items-center justify-center rounded bg-trust-blue/10 text-trust-blue hover:bg-trust-blue/20 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <LedgerAutocomplete
                  value={ledger}
                  onChange={setLedger}
                  behaviour="customer"
                  placeholder="Search customer ledger…"
                />
              </div>
            </div>
          </div>
          <div className="w-40">
            <label className="text-xs text-slate-500">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col mt-3">
        <ServiceFormFields
          form={form}
          setForm={setForm}
          lines={lines}
          setLines={setLines}
          ledger={ledger}
          setLedger={setLedger}
          items={items}
          staffs={staffs}
          hideLedgerDate
          fillHeight
        />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm mt-3">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-4 text-xs min-h-[1.5rem]">
            {ledger && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">{ledger.name} Balance:</span>
                <span className={`font-bold ${balance < 0 ? 'text-debit-red' : 'text-credit-green'}`}>
                  {formatCurrency(Math.abs(balance))}
                  {balance < 0 ? ' Dr' : ' Cr'}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Service'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
