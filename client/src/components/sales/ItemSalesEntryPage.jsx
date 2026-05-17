import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { itemApi, saleApi } from '../../api';
import { ITEM_UNITS, DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import { formatCurrency, todayISO } from '../../utils/helpers';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import LoadingSpinner from '../ui/LoadingSpinner';

const FIELD_ORDER = ['itemName', 'unit', 'rate', 'discount'];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function computeAmount({ rate, discount_percent }) {
  const r = parseFloat(rate) || 0;
  const d = parseFloat(discount_percent) || 0;
  return Math.round(r * (1 - d / 100) * 100) / 100;
}

function emptyLine() {
  return {
    item_id: null,
    item_name: '',
    unit: DEFAULT_ITEM_UNIT,
    mrp: 0,
    rate: '',
    discount_percent: '',
    amount: 0,
  };
}

function ItemNameCell({ value, items, onSelect, onChange, registerRef, onKeyEnter, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [anchorRect, setAnchorRect] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    registerRef(inputRef);
  }, [registerRef]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recompute dropdown position when opened, or on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (inputRef.current) {
        setAnchorRect(inputRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = (value || '').toLowerCase().trim();
    if (!q) return items.slice(0, 20);
    return items
      .filter((it) =>
        it.name.toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [items, value]);

  useEffect(() => { setHighlight(0); }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) {
        onSelect(filtered[highlight]);
        setOpen(false);
      }
      onKeyEnter();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search item by name, brand, category…"
          className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onAddNew}
          title="Create new item"
          className="flex h-7 w-7 items-center justify-center rounded bg-trust-blue/10 text-trust-blue hover:bg-trust-blue/20 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {open && anchorRect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: anchorRect.left,
            width: Math.max(anchorRect.width, 320),
            zIndex: 1000,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-slate-400">
              No items match. Press the + button to create one.
            </div>
          ) : (
            filtered.map((it, idx) => (
              <button
                type="button"
                key={it.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(it); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  idx === highlight ? 'bg-trust-blue/10' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 truncate">{it.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">#{it.id}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {[it.brand, it.category].filter(Boolean).join(' · ') || '—'}
                  <span className="ml-2 text-slate-400">{formatCurrency(it.mrp)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ItemSalesEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: saleIdParam } = useParams();
  const isEdit = Boolean(saleIdParam);

  const [items, setItems] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [saleNumber, setSaleNumber] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHHMM());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // refs: { [rowIndex]: { itemName, unit, rate, discount } -> ref }
  const cellRefs = useRef({});
  const setCellRef = (row, field, ref) => {
    if (!cellRefs.current[row]) cellRefs.current[row] = {};
    cellRefs.current[row][field] = ref;
  };
  const focusCell = (row, field) => {
    const r = cellRefs.current[row]?.[field];
    setTimeout(() => r?.current?.focus(), 0);
  };

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
      saleApi.getNextNumber().then((r) => setSaleNumber(r.data?.sale_number || '')).catch(() => {});
    }
  }, [refreshItems, isEdit]);

  // Load existing sale (edit mode)
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    saleApi.getById(saleIdParam)
      .then((res) => {
        const sale = res.data;
        setSaleNumber(sale.sale_number);
        setDate(sale.date);
        setTime(sale.time || '');
        setNotes(sale.notes || '');
        setLedger({ id: sale.ledger_id, name: sale.ledger_name, behaviour: 'customer' });
        setLines(
          (sale.items || []).map((l) => ({
            item_id: l.item_id,
            item_name: l.item_name,
            unit: l.unit || DEFAULT_ITEM_UNIT,
            mrp: l.mrp || 0,
            rate: String(l.rate),
            discount_percent: l.discount_percent ? String(l.discount_percent) : '',
            amount: l.amount,
          }))
        );
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, saleIdParam]);

  // After returning from the item creation page, pick up the newly created item.
  useEffect(() => {
    const raw = sessionStorage.getItem('lastCreatedItem');
    if (!raw) return;
    sessionStorage.removeItem('lastCreatedItem');
    try {
      const newItem = JSON.parse(raw);
      refreshItems();
      // Find first empty line or append one and apply the new item
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
          amount: computeAmount({ rate: newItem.mrp, discount_percent: 0 }),
        };
        return next;
      });
    } catch (_) { /* noop */ }
  }, [location.key, refreshItems]);

  const updateLine = (idx, patch) => {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      merged.amount = computeAmount(merged);
      next[idx] = merged;
      return next;
    });
  };

  const removeLine = (idx) => {
    setLines((prev) => {
      if (prev.length <= 1) return [emptyLine()];
      return prev.filter((_, i) => i !== idx);
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    setTimeout(() => focusCell(lines.length, 'itemName'), 0);
  };

  const handleSelectItem = (idx, item) => {
    updateLine(idx, {
      item_id: item.id,
      item_name: item.name,
      unit: item.unit || DEFAULT_ITEM_UNIT,
      mrp: item.mrp || 0,
      rate: String(item.mrp || ''),
    });
  };

  const handleCellEnter = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    if (currentIdx < FIELD_ORDER.length - 1) {
      focusCell(rowIdx, FIELD_ORDER[currentIdx + 1]);
    } else {
      // Last field (discount) — add new row and focus its item name
      const isLastRow = rowIdx === lines.length - 1;
      if (isLastRow) {
        setLines((prev) => [...prev, emptyLine()]);
        setTimeout(() => focusCell(rowIdx + 1, 'itemName'), 0);
      } else {
        focusCell(rowIdx + 1, 'itemName');
      }
    }
  };

  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const grossTotal = lines.reduce(
      (s, l) => s + (parseFloat(l.rate) || 0) * 1,
      0
    );
    const discountTotal = Math.max(0, grossTotal - total);
    const lineCount = lines.filter((l) => l.item_name && l.item_name.trim()).length;
    return { total, discountTotal, lineCount };
  }, [lines]);

  const handleSave = async () => {
    if (!ledger) { toast.error('Select a customer ledger'); return; }
    const validLines = lines.filter((l) => l.item_name && l.item_name.trim());
    if (validLines.length === 0) { toast.error('Add at least one item line'); return; }

    for (let i = 0; i < validLines.length; i++) {
      const l = validLines[i];
      if (parseFloat(l.rate) < 0 || isNaN(parseFloat(l.rate))) {
        toast.error(`Row ${i + 1}: rate is invalid`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger.id,
        date,
        time,
        notes,
        items: validLines.map((l) => ({
          item_id: l.item_id,
          item_name: l.item_name.trim(),
          unit: l.unit || DEFAULT_ITEM_UNIT,
          mrp: parseFloat(l.mrp) || 0,
          rate: parseFloat(l.rate) || 0,
          quantity: 1,
          discount_percent: parseFloat(l.discount_percent) || 0,
          amount: parseFloat(l.amount) || 0,
        })),
      };
      const res = isEdit
        ? await saleApi.update(saleIdParam, payload)
        : await saleApi.create(payload);
      toast.success(isEdit ? 'Sale updated' : `Sale #${res.data.sale_number} saved`);
      navigate('/item-sales');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewItem = (rowIdx) => {
    const currentName = lines[rowIdx]?.item_name || '';
    const qs = new URLSearchParams({
      returnTo: isEdit ? `/item-sales/${saleIdParam}/edit` : '/item-sales/new',
      ...(currentName ? { name: currentName } : {}),
    }).toString();
    navigate(`/items/new?${qs}`);
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">{isEdit ? 'Edit Sale' : 'Item Sales Entry'}</h1>
            <p className="text-sm text-slate-500">
              Sale #{saleNumber || '—'}
            </p>
          </div>
        </div>

        {/* Top-right: customer ledger + date + time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:w-auto w-full">
          <div className="sm:w-64">
            <label className="text-xs text-slate-500">Customer Ledger *</label>
            <LedgerAutocomplete
              value={ledger}
              onChange={setLedger}
              behaviour="customer"
              placeholder="Search customer…"
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
          <div>
            <label className="text-xs text-slate-500">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">S.no</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">Item ID</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 min-w-[18rem]">Item Name</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-28">Unit</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">MRP</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28">Rate</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">Disc %</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28">Amount</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {line.item_id || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <ItemNameCell
                      value={line.item_name}
                      items={items}
                      onChange={(v) => updateLine(idx, { item_name: v, item_id: null })}
                      onSelect={(it) => handleSelectItem(idx, it)}
                      registerRef={(ref) => setCellRef(idx, 'itemName', ref)}
                      onKeyEnter={() => handleCellEnter(idx, 'itemName')}
                      onAddNew={() => handleAddNewItem(idx)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      ref={(el) => setCellRef(idx, 'unit', { current: el })}
                      value={line.unit}
                      onChange={(e) => updateLine(idx, { unit: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'unit'); }
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                    >
                      {ITEM_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(line.mrp || 0)}</td>
                  <td className="px-3 py-2">
                    <input
                      ref={(el) => setCellRef(idx, 'rate', { current: el })}
                      type="number"
                      step="0.01"
                      value={line.rate}
                      onChange={(e) => updateLine(idx, { rate: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'rate'); }
                      }}
                      className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      ref={(el) => setCellRef(idx, 'discount', { current: el })}
                      type="number"
                      step="0.01"
                      value={line.discount_percent}
                      onChange={(e) => updateLine(idx, { discount_percent: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'discount'); }
                      }}
                      className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {formatCurrency(line.amount || 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      title="Remove row"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-trust-blue hover:underline flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            Add row
          </button>
          <p className="text-xs text-slate-500">
            Tip: press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Enter</kbd> to move between cells. Enter on the last cell adds a new row.
          </p>
        </div>
      </div>

      {/* Footer: notes + totals + save */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-slate-500">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input-field"
            placeholder="Optional remarks for this sale"
          />
        </div>
        <div className="card space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Items</span>
            <span className="font-medium">{totals.lineCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Total Discount</span>
            <span className="font-medium text-amber-700">{formatCurrency(totals.discountTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-base border-t border-slate-200 pt-1.5 mt-1.5">
            <span className="font-semibold text-slate-700">Total Amount</span>
            <span className="font-bold text-debit-red">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => navigate('/item-sales')} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving…' : (isEdit ? 'Update Sale' : 'Save Sale')}
        </button>
      </div>
    </div>
  );
}
