import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import { itemApi, estimationApi } from '../../api';
import { DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import { formatCurrency, todayISO } from '../../utils/helpers';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import LoadingSpinner from '../ui/LoadingSpinner';
import ItemLineGrid, { emptyLine, computeAmount } from '../ui/ItemLineGrid';

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function EstimationEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: estimationIdParam } = useParams();
  const isEdit = Boolean(estimationIdParam);

  const [items, setItems] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [estimationNumber, setEstimationNumber] = useState('');
  const [date, setDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState('open');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const readOnly = status === 'converted';

  const refreshItems = useCallback(async () => {
    try {
      const res = await itemApi.getAll();
      setItems(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    refreshItems();
    if (!isEdit) {
      estimationApi.getNextNumber()
        .then((r) => setEstimationNumber(r.data?.estimation_number || ''))
        .catch(() => {});
    }
  }, [refreshItems, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    estimationApi.getById(estimationIdParam)
      .then((res) => {
        const e = res.data;
        setEstimationNumber(e.estimation_number);
        setDate(e.date);
        setValidUntil(e.valid_until || '');
        setStatus(e.status || 'open');
        setNotes(e.notes || '');
        setCustomerName(e.customer_name || '');
        if (e.ledger_id) setLedger({ id: e.ledger_id, name: e.ledger_name, behaviour: 'customer' });
        setLines(
          (e.items || []).map((l) => ({
            item_id: l.item_id,
            item_name: l.item_name,
            unit: l.unit || DEFAULT_ITEM_UNIT,
            mrp: l.mrp || 0,
            rate: String(l.rate),
            quantity: String(l.quantity ?? 1),
            discount_percent: l.discount_percent ? String(l.discount_percent) : '',
            gst_percent: l.gst_percent ? String(l.gst_percent) : '',
            amount: l.amount,
            current_stock: null,
            original_quantity: 0,
          })),
        );
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, estimationIdParam]);

  // pick up newly-created item via sessionStorage hop
  useEffect(() => {
    const raw = sessionStorage.getItem('lastCreatedItem');
    if (!raw) return;
    sessionStorage.removeItem('lastCreatedItem');
    try {
      const newItem = JSON.parse(raw);
      refreshItems();
      setLines((prev) => {
        const idx = prev.findIndex((l) => !l.item_name);
        const target = idx >= 0 ? idx : prev.length;
        const next = idx >= 0 ? [...prev] : [...prev, emptyLine()];
        next[target] = {
          ...next[target],
          item_id: newItem.id,
          item_name: newItem.name,
          unit: newItem.unit || DEFAULT_ITEM_UNIT,
          mrp: newItem.mrp || 0,
          rate: String(newItem.mrp || ''),
          quantity: '1',
          gst_percent: newItem.gst_percent ? String(newItem.gst_percent) : '',
          amount: computeAmount({ rate: newItem.mrp, quantity: 1, discount_percent: 0, gst_percent: newItem.gst_percent || 0 }),
        };
        return next;
      });
    } catch (_) { /* noop */ }
  }, [location.key, refreshItems]);

  const handleAddNewItem = (rowIdx) => {
    const currentName = lines[rowIdx]?.item_name || '';
    const qs = new URLSearchParams({
      returnTo: isEdit ? `/estimation/${estimationIdParam}/edit` : '/estimation',
      ...(currentName ? { name: currentName } : {}),
    }).toString();
    navigate(`/items/new?${qs}`);
  };

  const validLines = lines.filter((l) => l.item_name && l.item_name.trim());
  const totals = ItemLineGrid.computeTotals(lines);

  const handleSave = async () => {
    if (!ledger && !customerName.trim()) {
      toast.error('Select a customer ledger or enter a customer name');
      return;
    }
    if (validLines.length === 0) {
      toast.error('Add at least one item line');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger?.id || null,
        customer_name: customerName.trim() || null,
        date,
        valid_until: validUntil || null,
        notes,
        items: validLines.map((l) => ({
          item_id: l.item_id,
          item_name: l.item_name.trim(),
          unit: l.unit || DEFAULT_ITEM_UNIT,
          mrp: parseFloat(l.mrp) || 0,
          rate: parseFloat(l.rate) || 0,
          quantity: parseFloat(l.quantity) || 1,
          discount_percent: parseFloat(l.discount_percent) || 0,
          gst_percent: parseFloat(l.gst_percent) || 0,
          amount: parseFloat(l.amount) || 0,
        })),
      };
      const res = isEdit
        ? await estimationApi.update(estimationIdParam, payload)
        : await estimationApi.create(payload);
      toast.success(isEdit ? 'Estimation updated' : `Estimation #${res.data.estimation_number} saved`);
      navigate('/estimations');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!isEdit) return;
    if (!ledger) {
      toast.error('A customer ledger is required to convert this estimation to a sale');
      return;
    }
    if (!window.confirm(`Convert estimation #${estimationNumber} to a sale? This will deduct stock and update the customer balance.`)) {
      return;
    }
    try {
      setConverting(true);
      const res = await estimationApi.convert(estimationIdParam);
      toast.success(`Converted to sale #${res.data.sale_number}`);
      navigate('/item-sales');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">{isEdit ? 'Edit Estimation' : 'New Estimation'}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <span>Estimation #{estimationNumber || '—'}</span>
              {isEdit && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
                  {status}
                </span>
              )}
            </p>
          </div>
          {isEdit && status === 'open' && (
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting}
              className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              title="Convert to a sale invoice"
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
              {converting ? 'Converting…' : 'Convert to Sale'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:w-auto w-full">
          <div className="sm:w-56">
            <label className="text-xs text-slate-500">Customer Ledger</label>
            <LedgerAutocomplete
              value={ledger}
              onChange={(l) => { setLedger(l); if (l) setCustomerName(l.name || ''); }}
              behaviour="customer"
              placeholder="Search customer…"
            />
          </div>
          <div className="sm:w-48">
            <label className="text-xs text-slate-500">Or Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-field"
              placeholder="Walk-in customer"
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="input-field"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className={`card p-0 overflow-hidden flex flex-col flex-1 min-h-0 mt-3 ${readOnly ? 'opacity-60 pointer-events-none' : ''}`}>
        <ItemLineGrid
          lines={lines}
          onLinesChange={setLines}
          items={items}
          onAddNewItem={handleAddNewItem}
          stockPolicy="none"
          showStockWarning={false}
          onToast={(type, msg) => (type === 'error' ? toast.error(msg) : toast(msg))}
        />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm mt-3">
        <div className="px-4 pt-4 pb-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Optional remarks for this estimation"
              disabled={readOnly}
            />
          </div>
          <div className="flex flex-col justify-between gap-2 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-medium text-slate-700">{totals.lineCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Discount</span>
                <span className="font-medium text-amber-700">{formatCurrency(totals.discountTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total GST</span>
                <span className="font-medium text-blue-700">{formatCurrency(totals.gstTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold text-slate-700">Estimated Total</span>
              <span className="font-bold text-lg text-trust-blue">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
          <button type="button" onClick={() => navigate('/estimations')} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || readOnly}
            className="btn-primary"
            title={readOnly ? 'Converted estimations cannot be modified' : undefined}
          >
            {saving ? 'Saving…' : (isEdit ? 'Update Estimation' : 'Save Estimation')}
          </button>
        </div>
      </div>
    </div>
  );
}
