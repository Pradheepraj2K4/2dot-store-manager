import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { itemApi, purchaseApi, ledgerApi, settingsApi } from '../../api';
import { ITEM_UNITS, DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import { formatCurrency, todayISO } from '../../utils/helpers';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import LoadingSpinner from '../ui/LoadingSpinner';
import GstSelect from '../ui/GstSelect';

const FIELD_ORDER = ['itemName', 'unit', 'rate', 'qty', 'discount'];

// localStorage key for the in-progress (new) purchase entry, so partially
// filled data survives navigating to another menu and back.
const PURCHASE_DRAFT_KEY = 'item_purchase_entry_draft';

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function computeAmount({ rate, quantity, discount_percent }) {
  const r = parseFloat(rate) || 0;
  const q = parseFloat(quantity) || 1;
  const d = parseFloat(discount_percent) || 0;
  // GST is inclusive: the rate already contains tax, so the line amount is
  // simply the (discounted) rate × quantity. The tax portion is extracted
  // separately for display in the GST total.
  const amount = r * q * (1 - d / 100);
  return Math.round(amount * 100) / 100;
}

function emptyLine() {
  return {
    item_id: null,
    item_name: '',
    unit: DEFAULT_ITEM_UNIT,
    mrp: 0,
    rate: '',
    quantity: '1',
    discount_percent: '',
    gst_percent: '',
    amount: 0,
    current_stock: null,
    imeis: [],
  };
}

function ItemNameCell({ value, items, selected, onSelect, onChange, registerRef, onKeyEnter, onAddNew, onEnterEmpty }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [anchorRect, setAnchorRect] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { registerRef(inputRef); }, [registerRef]);

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

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (inputRef.current) setAnchorRect(inputRef.current.getBoundingClientRect());
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
        (it.item_code || '').toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [items, value]);

  useEffect(() => { setHighlight(-1); }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && highlight >= 0 && filtered[highlight]) {
        onSelect(filtered[highlight]);
        setOpen(false);
        onKeyEnter();
      } else if (selected) {
        // An item is already chosen (e.g. picked with the mouse) — advance to
        // the next field instead of getting stuck on the name input.
        setOpen(false);
        onKeyEnter();
      }
      // Empty field or typed-but-unmatched text — do nothing, keep focus on
      // the item name input.
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
          placeholder="Search by code, name, brand, category…"
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
            minWidth: 420,
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
                <div className="flex items-center gap-4 whitespace-nowrap">
                  <span className="text-[10px] font-mono text-slate-400">{it.id}</span>
                  {it.item_code ? (
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {it.item_code}
                    </span>
                  ) : null}
                  <span className="font-medium text-slate-800">{it.name}</span>
                  <span className="text-xs text-slate-400">{[it.brand, it.category].filter(Boolean).join(' · ')}</span>
                  <span className="text-xs text-slate-500">{formatCurrency(it.mrp)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Quantity cell with an inline IMEI entry panel. When IMEI tracking is enabled
// and a linked item is selected, a dropdown of `qty` IMEI inputs is shown while
// the quantity (or any IMEI input) is focused. ArrowDown from the quantity input
// jumps to the first IMEI field; Enter chains focus through the IMEI fields and
// then advances to the next column.
function ImeiQtyCell({
  enabled,
  hasItem,
  quantity,
  imeis,
  onQuantityChange,
  onImeisChange,
  registerRef,
  onKeyEnter,
  invalid,
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const imeiRefs = useRef([]);

  useEffect(() => { registerRef(inputRef); }, [registerRef]);

  const qty = Math.max(0, Math.floor(parseFloat(quantity) || 0));
  const showPanel = enabled && hasItem && qty > 0;

  // Keep the IMEI slot array length in sync with the quantity.
  const slots = useMemo(() => {
    const arr = Array.isArray(imeis) ? imeis.slice(0, qty) : [];
    while (arr.length < qty) arr.push('');
    return arr;
  }, [imeis, qty]);

  useEffect(() => {
    if (!open || !showPanel) return;
    const update = () => {
      if (inputRef.current) setAnchorRect(inputRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, showPanel]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setImeiAt = (i, val) => {
    const next = slots.slice();
    next[i] = val;
    onImeisChange(next);
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === 'ArrowDown' && showPanel) {
      e.preventDefault();
      setOpen(true);
      setTimeout(() => imeiRefs.current[0]?.focus(), 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onKeyEnter();
    }
  };

  const handleImeiKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i < qty - 1) {
        imeiRefs.current[i + 1]?.focus();
      } else {
        setOpen(false);
        onKeyEnter();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (i < qty - 1) imeiRefs.current[i + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i > 0) imeiRefs.current[i - 1]?.focus();
      else inputRef.current?.focus();
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  const filledCount = slots.filter((s) => String(s || '').trim()).length;

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        const root = e.currentTarget;
        setTimeout(() => {
          if (!root.contains(document.activeElement) &&
              !(panelRef.current && panelRef.current.contains(document.activeElement))) {
            setOpen(false);
          }
        }, 0);
      }}
    >
      <input
        ref={inputRef}
        type="number"
        step="0.001"
        min="0"
        value={quantity}
        onChange={(e) => onQuantityChange(e.target.value)}
        onFocus={() => { if (showPanel) setOpen(true); }}
        onKeyDown={handleQtyKeyDown}
        className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-1 ${
          invalid
            ? 'border-debit-red focus:border-debit-red focus:ring-debit-red'
            : 'border-slate-200 focus:border-trust-blue focus:ring-trust-blue'
        }`}
        placeholder="1"
      />

      {showPanel && open && anchorRect && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: Math.max(8, anchorRect.right - 240),
            width: 240,
            zIndex: 1000,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg p-2"
        >
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-600">Enter IMEI numbers</span>
            <span className="text-[10px] text-slate-400">{filledCount}/{qty}</span>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {slots.map((val, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-right text-[10px] font-mono text-slate-400">{i + 1}</span>
                <input
                  ref={(el) => { imeiRefs.current[i] = el; }}
                  type="text"
                  value={val}
                  onChange={(e) => setImeiAt(i, e.target.value)}
                  onKeyDown={(e) => handleImeiKeyDown(e, i)}
                  placeholder={`IMEI ${i + 1}`}
                  className={`flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 ${
                    invalid && !String(val || '').trim()
                      ? 'border-debit-red focus:border-debit-red focus:ring-debit-red'
                      : 'border-slate-200 focus:border-trust-blue focus:ring-trust-blue'
                  }`}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ItemPurchaseEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: purchaseIdParam } = useParams();
  const isEdit = Boolean(purchaseIdParam);

  const [items, setItems] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHHMM());
  const [notes, setNotes] = useState('');
  const [billDiscount, setBillDiscount] = useState('0');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [imeiEnabled, setImeiEnabled] = useState(false);
  // When a save is attempted with missing IMEIs, highlight the offending rows
  // until the operator enters the required count. Cleared once valid.
  const [showImeiErrors, setShowImeiErrors] = useState(false);
  // Tracks whether the saved draft has been restored, so the auto-save effect
  // doesn't overwrite it with the initial empty state before restore runs.
  const draftLoaded = useRef(false);

  const cellRefs = useRef({});
  const setCellRef = (row, field, ref) => {
    if (!cellRefs.current[row]) cellRefs.current[row] = {};
    cellRefs.current[row][field] = ref;
  };
  const focusCell = (row, field) => {
    const r = cellRefs.current[row]?.[field];
    setTimeout(() => r?.current?.focus(), 0);
  };

  // Wraps the ledger LedgerAutocomplete so its input can be focused on demand.
  const ledgerFieldRef = useRef(null);
  const focusLedger = () => {
    setTimeout(() => {
      const el = ledgerFieldRef.current?.querySelector('input, [tabindex]');
      el?.focus();
    }, 0);
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
      purchaseApi.getNextNumber()
        .then((r) => setPurchaseNumber(r.data?.purchase_number || ''))
        .catch(() => {});
    }
  }, [refreshItems, isEdit]);

  // Load the IMEI-tracking toggle once on mount.
  useEffect(() => {
    settingsApi.get('imei_tracking_enabled')
      .then((r) => {
        const v = r.data?.value;
        setImeiEnabled(v === true || v === 'true');
      })
      .catch(() => {});
  }, []);

  // ── Draft persistence ───────────────────────────────────────────
  // Restore a partially-filled new entry when returning to this page, and
  // auto-save changes so switching to another menu doesn't lose the data.
  useEffect(() => {
    if (isEdit) { draftLoaded.current = true; return; }
    try {
      const raw = localStorage.getItem(PURCHASE_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.ledger) setLedger(d.ledger);
        if (d.billNumber != null) setBillNumber(d.billNumber);
        if (d.date) setDate(d.date);
        if (d.time != null) setTime(d.time);
        if (d.notes != null) setNotes(d.notes);
        if (d.billDiscount != null) setBillDiscount(d.billDiscount);
        if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
      }
    } catch (_) { /* ignore malformed draft */ }
    draftLoaded.current = true;
  }, [isEdit]);

  useEffect(() => {
    if (isEdit || !draftLoaded.current) return;
    const meaningful =
      Boolean(ledger) ||
      (billNumber && billNumber.trim()) ||
      (notes && notes.trim()) ||
      lines.some((l) => l.item_name && l.item_name.trim());
    try {
      if (meaningful) {
        localStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify({
          ledger, billNumber, date, time, notes, billDiscount, lines,
        }));
      } else {
        localStorage.removeItem(PURCHASE_DRAFT_KEY);
      }
    } catch (_) { /* ignore storage quota errors */ }
  }, [isEdit, ledger, billNumber, date, time, notes, billDiscount, lines]);

  // When returning from the ledger-creation page (opened via the '+' button),
  // auto-select the freshly created ledger.
  useEffect(() => {
    const newLedgerId = location.state?.newLedgerId;
    if (!newLedgerId) return;
    ledgerApi.getById(newLedgerId)
      .then((r) => { if (r.data) setLedger(r.data); })
      .catch(() => {})
      .finally(() => {
        navigate(location.pathname + location.search, { replace: true, state: {} });
      });
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    purchaseApi.getById(purchaseIdParam)
      .then((res) => {
        const p = res.data;
        setPurchaseNumber(p.purchase_number);
        setBillNumber(p.bill_number || '');
        setDate(p.date);
        setTime(p.time || '');
        setNotes(p.notes || '');
        setBillDiscount(p.bill_discount != null ? String(p.bill_discount) : '0');
        setLedger({ id: p.ledger_id, name: p.ledger_name });
        setLines(
          (p.items || []).map((l) => ({
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
            imeis: Array.isArray(l.imeis) ? l.imeis : [],
          }))
        );
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, purchaseIdParam]);

  // F10 → purchase report
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/purchase-report');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // After returning from item creation
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
          rate: '',
          quantity: '1',
          gst_percent: newItem.gst_percent ? String(newItem.gst_percent) : '',
          current_stock: newItem.current_stock ?? 0,
          amount: 0,
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
    const hasEmptyRow = lines.some((l) => !l.item_id);
    if (hasEmptyRow) {
      const emptyIdx = lines.findIndex((l) => !l.item_id);
      focusCell(emptyIdx, 'itemName');
      return;
    }
    setLines((prev) => [...prev, emptyLine()]);
    setTimeout(() => focusCell(lines.length, 'itemName'), 0);
  };

  const handleSelectItem = (idx, item) => {
    updateLine(idx, {
      item_id: item.id,
      item_name: item.name,
      unit: item.unit || DEFAULT_ITEM_UNIT,
      mrp: item.mrp || 0,
      rate: '',
      quantity: '1',
      gst_percent: item.gst_percent ? String(item.gst_percent) : '',
      current_stock: item.current_stock ?? 0,
      imeis: [],
    });
  };

  const handleCellEnter = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    if (currentIdx < FIELD_ORDER.length - 1) {
      focusCell(rowIdx, FIELD_ORDER[currentIdx + 1]);
    } else {
      const isLastRow = rowIdx === lines.length - 1;
      if (isLastRow) {
        const hasEmptyRow = lines.some((l) => !l.item_id);
        if (hasEmptyRow) {
          const emptyIdx = lines.findIndex((l) => !l.item_id);
          focusCell(emptyIdx, 'itemName');
        } else {
          setLines((prev) => [...prev, emptyLine()]);
          setTimeout(() => focusCell(rowIdx + 1, 'itemName'), 0);
        }
      } else {
        focusCell(rowIdx + 1, 'itemName');
      }
    }
  };

  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const gstTotal = lines.reduce((s, l) => {
      const r = parseFloat(l.rate) || 0;
      const q = parseFloat(l.quantity) || 1;
      const d = parseFloat(l.discount_percent) || 0;
      const g = parseFloat(l.gst_percent) || 0;
      // GST is inclusive — extract the embedded tax from the gross amount.
      const inclusive = r * q * (1 - d / 100);
      const gst = inclusive - inclusive / (1 + g / 100);
      return s + Math.round(gst * 100) / 100;
    }, 0);
    const discountTotal = lines.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const d = parseFloat(l.discount_percent) || 0;
      return s + gross * d / 100;
    }, 0);
    const lineCount = lines.filter((l) => l.item_name && l.item_name.trim()).length;
    const qtyTotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
    return { total, discountTotal, gstTotal, lineCount, qtyTotal };
  }, [lines]);

  const netTotal = Math.max(0, totals.total - (parseFloat(billDiscount) || 0));

  const handleSave = async () => {
    if (!ledger) { toast.error('Select a ledger'); return; }
    const validLines = lines.filter((l) => l.item_name && l.item_name.trim());
    if (validLines.length === 0) { toast.error('Add at least one item line'); return; }
    for (let i = 0; i < validLines.length; i++) {
      const l = validLines[i];
      if (isNaN(parseFloat(l.rate)) || parseFloat(l.rate) < 0) {
        toast.error(`Row ${i + 1}: rate is invalid`);
        return;
      }
      if (isNaN(parseFloat(l.quantity)) || parseFloat(l.quantity) <= 0) {
        toast.error(`Row ${i + 1}: quantity must be greater than zero`);
        return;
      }
    }

    // When IMEI tracking is on, every linked-item line must carry one IMEI per
    // unit, and IMEIs must be unique across the bill.
    if (imeiEnabled) {
      const seen = new Set();
      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i];
        const imeis = Array.isArray(l.imeis) ? l.imeis.map((s) => String(s || '').trim()).filter(Boolean) : [];
        if (l.item_id) {
          const qty = Math.floor(parseFloat(l.quantity) || 0);
          if (imeis.length !== qty) {
            setShowImeiErrors(true);
            toast.error(`Row ${i + 1}: enter ${qty} IMEI${qty === 1 ? '' : 's'} for "${l.item_name}" (entered ${imeis.length})`);
            return;
          }
        }
        for (const imei of imeis) {
          if (seen.has(imei)) {
            toast.error(`Duplicate IMEI "${imei}" entered`);
            return;
          }
          seen.add(imei);
        }
      }
      setShowImeiErrors(false);
    }

    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger.id,
        bill_number: billNumber,
        date,
        time,
        notes,
        bill_discount: parseFloat(billDiscount) || 0,
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
          imeis: imeiEnabled
            ? (Array.isArray(l.imeis) ? l.imeis.map((s) => String(s || '').trim()).filter(Boolean) : [])
            : [],
        })),
      };
      const res = isEdit
        ? await purchaseApi.update(purchaseIdParam, payload)
        : await purchaseApi.create(payload);
      toast.success(isEdit ? 'Purchase updated' : `Purchase ${res.data.purchase_number} saved`);
      if (!isEdit) {
        localStorage.removeItem(PURCHASE_DRAFT_KEY);
        setLedger(null);
        setBillNumber('');
        setDate(todayISO());
        setTime(nowHHMM());
        setNotes('');
        setBillDiscount('0');
        setLines([emptyLine()]);
        purchaseApi.getNextNumber()
          .then((r) => setPurchaseNumber(r.data?.purchase_number || ''))
          .catch(() => {});
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewItem = (rowIdx) => {
    const currentName = lines[rowIdx]?.item_name || '';
    const qs = new URLSearchParams({
      returnTo: isEdit ? `/item-purchases/${purchaseIdParam}/edit` : '/item-purchases/new',
      ...(currentName ? { name: currentName } : {}),
    }).toString();
    navigate(`/items/new?${qs}`);
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
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
            <h1 className="page-title">{isEdit ? 'Edit Purchase' : 'Item Purchase'}</h1>
            <p className="text-sm text-slate-500">
              Purchase {purchaseNumber || '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-52">
            <label className="text-xs text-slate-500">Supplier / Ledger *</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Create new ledger"
                onClick={() => navigate('/ledger-creation?returnTo=' + encodeURIComponent(location.pathname + location.search))}
                className="flex h-9 w-7 shrink-0 items-center justify-center rounded bg-trust-blue/10 text-trust-blue hover:bg-trust-blue/20 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0" ref={ledgerFieldRef}>
                <LedgerAutocomplete
                  value={ledger}
                  onChange={setLedger}
                  placeholder="Search ledger…"
                />
              </div>
            </div>
          </div>
          <div className="w-36">
            <label className="text-xs text-slate-500">Bill #</label>
            <input
              type="text"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              className="input-field"
              placeholder="Supplier invoice no."
            />
          </div>
          <div className="w-40">
            <label className="text-xs text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="w-36">
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

      <div className="card p-0 overflow-hidden flex flex-col flex-1 min-h-0 mt-3">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-600 sticky top-0 z-10">
                <th className="px-3 py-2 text-left font-semibold text-white w-12">S.no</th>
                <th className="px-3 py-2 text-left font-semibold text-white w-20 whitespace-nowrap">Item ID</th>
                <th className="px-3 py-2 text-left font-semibold text-white min-w-[18rem]">Item Name</th>
                <th className="px-3 py-2 text-left font-semibold text-white w-28">Unit</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-20 whitespace-nowrap">In Stock</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">MRP</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-28">Cost Rate</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">Qty</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">Disc %</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">GST %</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-28">Amount</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const stock = line.current_stock;
                return (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {line.item_id || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <ItemNameCell
                        value={line.item_name}
                        items={items}
                        selected={!!line.item_id}
                        onChange={(v) => updateLine(idx, { item_name: v, item_id: null, current_stock: null, imeis: [] })}
                        onSelect={(it) => handleSelectItem(idx, it)}
                        registerRef={(ref) => setCellRef(idx, 'itemName', ref)}
                        onKeyEnter={() => handleCellEnter(idx, 'itemName')}
                        onAddNew={() => handleAddNewItem(idx)}
                        onEnterEmpty={focusLedger}
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
                    <td className="px-3 py-2 text-right">
                      {stock == null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={Number(stock) < 0 ? 'text-debit-red font-medium' : 'text-slate-600'}>
                          {Number(stock)}
                        </span>
                      )}
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
                      <ImeiQtyCell
                        enabled={imeiEnabled}
                        hasItem={Boolean(line.item_id)}
                        quantity={line.quantity}
                        imeis={line.imeis}
                        onQuantityChange={(v) => updateLine(idx, { quantity: v })}
                        onImeisChange={(arr) => updateLine(idx, { imeis: arr })}
                        registerRef={(ref) => setCellRef(idx, 'qty', ref)}
                        onKeyEnter={() => handleCellEnter(idx, 'qty')}
                        invalid={
                          showImeiErrors && imeiEnabled && Boolean(line.item_id) &&
                          (Array.isArray(line.imeis) ? line.imeis.map((s) => String(s || '').trim()).filter(Boolean).length : 0) !==
                            Math.floor(parseFloat(line.quantity) || 0)
                        }
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
                    <td className="px-3 py-2 text-sm text-center text-slate-600">
                      {line.gst_percent ? `${line.gst_percent}%` : '—'}
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
                );
              })}
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
        </div>
      </div>

      <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm mt-3">
        <div className="px-4 pt-3 pb-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Optional remarks for this purchase"
            />
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5 text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-medium text-slate-700">{totals.lineCount}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5 text-sm">
                <span className="text-slate-500">Total Qty</span>
                <span className="font-medium text-slate-700">{totals.qtyTotal}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Item Discount</span>
                <span className="font-medium text-amber-700">{formatCurrency(totals.discountTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Bill Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value)}
                  className="w-28 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-sm text-amber-700 font-medium focus:border-trust-blue focus:outline-none focus:ring-1 focus:ring-trust-blue"
                />
              </div>
              {ledger?.igst_status === 'YES' ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">IGST</span>
                  <span className="font-medium text-blue-700">{formatCurrency(totals.gstTotal)}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">CGST</span>
                    <span className="font-medium text-blue-700">{formatCurrency(totals.gstTotal / 2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">SGST</span>
                    <span className="font-medium text-blue-700">{formatCurrency(totals.gstTotal / 2)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total GST</span>
                <span className="font-medium text-blue-700">{formatCurrency(totals.gstTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold text-slate-700">Total Amount</span>
              <span className="font-bold text-lg text-credit-green">{formatCurrency(netTotal)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-slate-100">
          <button type="button" onClick={() => navigate('/item-purchases')} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : (isEdit ? 'Update Purchase' : 'Save Purchase')}
          </button>
        </div>
      </div>
    </div>
  );
}
