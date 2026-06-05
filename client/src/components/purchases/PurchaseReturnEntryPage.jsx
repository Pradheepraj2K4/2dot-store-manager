import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { itemApi, purchaseReturnApi } from '../../api';
import { DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import { formatCurrency, todayISO } from '../../utils/helpers';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import LoadingSpinner from '../ui/LoadingSpinner';
import ItemLineGrid, { emptyLine, computeAmount } from '../ui/ItemLineGrid';

export default function PurchaseReturnEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: returnIdParam } = useParams();
  const isEdit = Boolean(returnIdParam);

  const [items, setItems] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [returnNumber, setReturnNumber] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

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
      purchaseReturnApi.getNextNumber()
        .then((r) => setReturnNumber(r.data?.return_number || ''))
        .catch(() => {});
    }
  }, [refreshItems, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    purchaseReturnApi.getById(returnIdParam)
      .then((res) => {
        const r = res.data;
        setReturnNumber(r.return_number);
        setDate(r.date);
        setReason(r.reason || '');
        setNotes(r.notes || '');
        setBillNumber(r.bill_number || '');
        setPurchaseId(r.purchase_id ? String(r.purchase_id) : '');
        if (r.ledger_id) setLedger({ id: r.ledger_id, name: r.ledger_name, behaviour: 'supplier' });
        setLines(
          (r.items || []).map((l) => ({
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
            original_quantity: parseFloat(l.quantity) || 0,
          })),
        );
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, returnIdParam]);

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
      returnTo: isEdit ? `/purchase-return/${returnIdParam}/edit` : '/purchase-return',
      ...(currentName ? { name: currentName } : {}),
    }).toString();
    navigate(`/items/new?${qs}`);
  };

  const validLines = lines.filter((l) => l.item_name && l.item_name.trim());
  const totals = ItemLineGrid.computeTotals(lines);

  const handleSave = async () => {
    if (!ledger) { toast.error('Select a supplier ledger'); return; }
    if (validLines.length === 0) { toast.error('Add at least one item line'); return; }

    // Stock check — returning items to supplier reduces stock
    const perItem = new Map();
    for (const l of validLines) {
      if (!l.item_id) continue;
      const entry = perItem.get(l.item_id) || {
        name: l.item_name,
        qty: 0,
        available: (Number(l.current_stock) || 0) + (Number(l.original_quantity) || 0),
        unit: l.unit,
      };
      entry.qty += parseFloat(l.quantity) || 0;
      perItem.set(l.item_id, entry);
    }
    for (const [, info] of perItem) {
      if (info.qty > info.available) {
        toast.error(`Quantity for "${info.name}" exceeds available stock (${info.available} ${info.unit || ''})`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger.id,
        purchase_id: purchaseId ? Number(purchaseId) : null,
        bill_number: billNumber || null,
        date,
        reason: reason || null,
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
        ? await purchaseReturnApi.update(returnIdParam, payload)
        : await purchaseReturnApi.create(payload);
      toast.success(isEdit ? 'Purchase return updated' : `Purchase return ${res.data.return_number} saved`);
      navigate('/purchase-returns');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
            <h1 className="page-title">{isEdit ? 'Edit Purchase Return' : 'Purchase Return Entry'}</h1>
            <p className="text-sm text-slate-500">Return {returnNumber || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:w-auto w-full">
          <div className="sm:w-56">
            <label className="text-xs text-slate-500">Supplier Ledger *</label>
            <LedgerAutocomplete
              value={ledger}
              onChange={setLedger}
              behaviour="supplier"
              placeholder="Search supplier…"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Original Purchase #</label>
            <input
              type="number"
              value={purchaseId}
              onChange={(e) => setPurchaseId(e.target.value)}
              className="input-field"
              placeholder="Optional"
              min="1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Bill #</label>
            <input
              type="text"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              className="input-field"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden flex flex-col flex-1 min-h-0 mt-3">
        <ItemLineGrid
          lines={lines}
          onLinesChange={setLines}
          items={items}
          onAddNewItem={handleAddNewItem}
          stockPolicy="deduct"
          onToast={(type, msg) => (type === 'error' ? toast.error(msg) : toast(msg))}
        />
      </div>

      <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm mt-3">
        <div className="px-4 pt-4 pb-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Reason for return</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                placeholder="e.g. Defective stock"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input-field resize-none"
                placeholder="Optional remarks"
              />
            </div>
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
              <span className="font-semibold text-slate-700">Return Value</span>
              <span className="font-bold text-lg text-debit-red">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
          <button type="button" onClick={() => navigate('/purchase-returns')} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : (isEdit ? 'Update Return' : 'Save Return')}
          </button>
        </div>
      </div>
    </div>
  );
}
