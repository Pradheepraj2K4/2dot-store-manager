import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  Cog6ToothIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { itemApi, saleApi, settingsApi, ledgerApi } from '../../api';
import { ITEM_UNITS, DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import { formatCurrency, todayISO } from '../../utils/helpers';
import { buildSaleReceiptHtml } from '../../utils/saleReceipt';
import { fetchLogoDataUrl } from '../../utils/interestReceipt';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import GstSelect from '../ui/GstSelect';

const FIELD_ORDER = ['itemName', 'unit', 'qty', 'rate', 'discount', 'gst'];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function computeAmount({ rate, quantity, discount_percent, gst_percent }) {
  const r = parseFloat(rate) || 0;
  const q = parseFloat(quantity) || 1;
  const d = parseFloat(discount_percent) || 0;
  const g = parseFloat(gst_percent) || 0;
  const taxable = r * q * (1 - d / 100);
  const gst = taxable * g / 100;
  return Math.round((taxable + gst) * 100) / 100;
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
    original_quantity: 0,
  };
}

// Max quantity that can be entered on a line without driving stock negative.
// For an edited line, the previously-saved quantity is added back since
// reversing the old line on save returns that stock.
function maxQtyFor(line) {
  if (!line.item_id || line.current_stock == null) return Infinity;
  return (parseFloat(line.current_stock) || 0) + (parseFloat(line.original_quantity) || 0);
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
        (it.item_code || '').toLowerCase().includes(q) ||
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
            minWidth: 760,
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
                  <span className="text-[10px] font-mono text-slate-400">#{it.id}</span>
                  {it.item_code ? (
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {it.item_code}
                    </span>
                  ) : null}
                  <span className="font-medium text-slate-800">{it.name}</span>
                  <span className="text-xs text-slate-400">{[it.brand, it.category].filter(Boolean).join(' · ')}</span>
                  <span className="text-xs text-slate-500">{formatCurrency(it.mrp)}</span>
                  <span className="text-xs">
                    Stock: <span className={Number(it.current_stock) <= 0 ? 'text-debit-red font-medium' : 'text-credit-green font-medium'}>{Number(it.current_stock || 0)}</span>
                  </span>
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
  const [billDiscount, setBillDiscount] = useState('0');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // ── Row focus tracking for cost-rate tag ────────────────────────
  const [focusedRow, setFocusedRow] = useState(null);
  const [stockLock, setStockLock] = useState(() => {
    const v = localStorage.getItem('sales_stock_lock');
    return v === null ? true : v === 'true';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleStockLock = (val) => {
    setStockLock(val);
    localStorage.setItem('sales_stock_lock', String(val));
  };

  // Ctrl+I opens settings dialog
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        setSettingsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Receipt / print state ─────────────────────────────────────────────
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('thermal');
  const [printEnabled, setPrintEnabled] = useState(false);
  const [previewModal, setPreviewModal] = useState({ open: false, html: '', sale: null });
  const previewIframeRef = useRef(null);
  const navigateAfterPreviewRef = useRef(false);

  // Load store profile + receipt config + print toggle on mount
  useEffect(() => {
    (async () => {
      const [profileRes, configRes, printRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
        settingsApi.get('print_receipts_sale_enabled').catch(() => ({ data: { value: 'false' } })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      const fmt = (configRes.data && configRes.data.format) || 'thermal';
      setReceiptFormat(['a4', 'a5', 'thermal'].includes(fmt) ? fmt : 'thermal');
      const pv = printRes.data?.value;
      setPrintEnabled(pv === true || pv === 'true');
      if (profile.logo_path) {
        const dl = await fetchLogoDataUrl(profile.logo_path);
        setLogoDataUrl(dl);
      }
    })();
  }, []);

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
      ledgerApi.getCash().then((r) => { if (r.data) setLedger(r.data); }).catch(() => {});
    }
  }, [refreshItems, isEdit]);

  // Whenever the items list refreshes, sync each line's current_stock snapshot
  // so newly-loaded or freshly-refreshed stock numbers reach the qty validator
  // and the row UI.
  useEffect(() => {
    if (!items.length) return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if (!l.item_id) return l;
        const item = items.find((it) => it.id === l.item_id);
        if (!item) return l;
        const stock = Number(item.current_stock ?? 0);
        if (l.current_stock === stock) return l;
        changed = true;
        return { ...l, current_stock: stock };
      });
      return changed ? next : prev;
    });
  }, [items]);

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
        setBillDiscount(sale.bill_discount != null ? String(sale.bill_discount) : '0');
        setLedger({ id: sale.ledger_id, name: sale.ledger_name, behaviour: 'customer' });
        setLines(
          (sale.items || []).map((l) => ({
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
          quantity: '1',
          gst_percent: newItem.gst_percent ? String(newItem.gst_percent) : '',
          amount: computeAmount({ rate: newItem.mrp, quantity: 1, discount_percent: 0, gst_percent: newItem.gst_percent || 0 }),
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
    const stock = Number(item.current_stock ?? 0);
    if (stockLock && stock <= 0) {
      toast.error(`"${item.name}" is out of stock`);
      return;
    }
    updateLine(idx, {
      item_id: item.id,
      item_name: item.name,
      unit: item.unit || DEFAULT_ITEM_UNIT,
      mrp: item.mrp || 0,
      rate: String(item.mrp || ''),
      quantity: '1',
      gst_percent: item.gst_percent ? String(item.gst_percent) : '',
      current_stock: stock,
      original_quantity: 0,
    });
  };

  const handleQuantityChange = (idx, value) => {
    const line = lines[idx];
    const max = maxQtyFor(line);
    const num = parseFloat(value);
    if (stockLock && !isNaN(num) && num > max) {
      toast.error(`Only ${max} ${line.unit || ''} available in stock`);
      updateLine(idx, { quantity: String(max) });
      return;
    }
    updateLine(idx, { quantity: value });
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
      (s, l) => s + (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1),
      0
    );
    const gstTotal = lines.reduce((s, l) => {
      const r = parseFloat(l.rate) || 0;
      const q = parseFloat(l.quantity) || 1;
      const d = parseFloat(l.discount_percent) || 0;
      const g = parseFloat(l.gst_percent) || 0;
      const taxable = r * q * (1 - d / 100);
      return s + Math.round(taxable * g / 100 * 100) / 100;
    }, 0);
    const discountTotal = lines.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const d = parseFloat(l.discount_percent) || 0;
      return s + gross * d / 100;
    }, 0);
    const lineCount = lines.filter((l) => l.item_name && l.item_name.trim()).length;
    return { total, discountTotal, gstTotal, lineCount };
  }, [lines]);

  const netTotal = Math.max(0, totals.total - (parseFloat(billDiscount) || 0));

  // Derives cost info for the currently focused item row (from last purchase)
  const focusedCostInfo = useMemo(() => {
    if (focusedRow == null) return null;
    const line = lines[focusedRow];
    if (!line?.item_id) return null;
    const item = items.find((it) => it.id === line.item_id);
    if (!item || item.last_purchase_rate == null) return null;
    const gst = item.last_purchase_gst || 0;
    const costRate = item.last_purchase_rate * (1 + gst / 100);
    return { costRate, gst, baseRate: item.last_purchase_rate };
  }, [focusedRow, lines, items]);

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

    // Stock check — aggregate quantities per item and ensure they don't
    // exceed each item's available stock (plus this sale's original quantity
    // if editing). Skipped when Stock Lock is disabled.
    if (stockLock) {
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
    }

    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger.id,
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
        })),
      };
      const res = isEdit
        ? await saleApi.update(saleIdParam, payload)
        : await saleApi.create(payload);
      toast.success(isEdit ? 'Sale updated' : `Sale #${res.data.sale_number} saved`);
      if (res.data) {
        openSalePreview(res.data, ledger?.name, true);
      } else {
        navigate('/item-sales');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openSalePreview = (sale, customerName, navigateAfter = false) => {
    const html = buildSaleReceiptHtml({
      sale,
      ledgerName: customerName || sale.ledger_name,
      store,
      logoDataUrl,
      format: receiptFormat,
    });
    navigateAfterPreviewRef.current = navigateAfter;
    setPreviewModal({ open: true, html, sale });
  };

  const closePreview = () => {
    const shouldNavigate = navigateAfterPreviewRef.current;
    navigateAfterPreviewRef.current = false;
    setPreviewModal({ open: false, html: '', sale: null });
    if (shouldNavigate) navigate('/item-sales');
  };

  const handlePrintCurrent = async () => {
    if (!isEdit) return;
    try {
      const res = await saleApi.getById(saleIdParam);
      openSalePreview(res.data, ledger?.name, false);
    } catch (err) {
      toast.error(err.message);
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
            <h1 className="page-title">{isEdit ? 'Edit Sale' : 'Item Sales Entry'}</h1>
            <p className="text-sm text-slate-500">
              Sale #{saleNumber || '—'}
            </p>
          </div>
          {isEdit && (
            <button
              type="button"
              onClick={handlePrintCurrent}
              className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="Print receipt"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Sales settings (Ctrl+I)"
          >
            <Cog6ToothIcon className="h-4 w-4" />
          </button>
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
      <div className="card p-0 overflow-hidden flex flex-col flex-1 min-h-0 mt-3">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-trust-blue sticky top-0 z-10">
                <th className="px-3 py-2 text-left font-semibold text-white w-12">S.no</th>
                <th className="px-3 py-2 text-left font-semibold text-white w-20">Item ID</th>
                <th className="px-3 py-2 text-left font-semibold text-white min-w-[18rem]">Item Name</th>
                <th className="px-3 py-2 text-left font-semibold text-white w-28">Unit</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">MRP</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-28">Rate</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">Qty</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">Disc %</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">GST %</th>
                <th className="px-3 py-2 text-right font-semibold text-white w-28">Amount</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-100"
                  onFocus={() => setFocusedRow(idx)}
                  onBlur={(e) => {
                    const row = e.currentTarget;
                    setTimeout(() => {
                      if (!row.contains(document.activeElement)) {
                        setFocusedRow(null);
                      }
                    }, 150);
                  }}
                >
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
                      ref={(el) => setCellRef(idx, 'qty', { current: el })}
                      type="number"
                      step="0.001"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'qty'); }
                      }}
                      className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-1 ${
                        line.item_id && parseFloat(line.quantity) > maxQtyFor(line)
                          ? 'border-debit-red focus:border-debit-red focus:ring-debit-red'
                          : 'border-slate-200 focus:border-trust-blue focus:ring-trust-blue'
                      }`}
                      placeholder="1"
                      title={line.item_id && line.current_stock != null ? `In stock: ${line.current_stock}` : undefined}
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
                  <td className="px-3 py-2">
                    <GstSelect
                      registerRef={(ref) => setCellRef(idx, 'gst', ref)}
                      value={line.gst_percent}
                      onChange={(v) => updateLine(idx, { gst_percent: v })}
                      onKeyEnter={() => handleCellEnter(idx, 'gst')}
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
        </div>
      </div>

      {/* Footer: notes + totals + save */}
      <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm mt-3">
        <div className="px-4 pt-4 pb-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Optional remarks for this sale"
            />
          </div>
          <div className="flex flex-col justify-between gap-2 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-medium text-slate-700">{totals.lineCount}</span>
              </div>
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
              <span className="font-bold text-lg text-debit-red">{formatCurrency(netTotal)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
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

      {/* Cost rate tag — shown when a row with a purchased item is focused */}
      {focusedCostInfo && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-slate-800/90 px-4 py-1.5 text-xs shadow-xl backdrop-blur-sm">
            <span className="text-slate-400 font-medium">Purchase Cost</span>
            <span className="font-bold text-white">{formatCurrency(focusedCostInfo.costRate)}</span>
            {focusedCostInfo.gst > 0 && (
              <span className="text-slate-400">
                ({formatCurrency(focusedCostInfo.baseRate)} + {focusedCostInfo.gst}% GST)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cost rate tag — shown when a row with a purchased item is focused */}
      {focusedCostInfo && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-slate-800/90 px-4 py-1.5 text-xs shadow-xl backdrop-blur-sm">
            <span className="text-slate-400 font-medium">Purchase Cost</span>
            <span className="font-bold text-white">{formatCurrency(focusedCostInfo.costRate)}</span>
            {focusedCostInfo.gst > 0 && (
              <span className="text-slate-400">
                ({formatCurrency(focusedCostInfo.baseRate)} + {focusedCostInfo.gst}% GST)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Item Sales Settings dialog */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Item Sales Settings">
        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Stock Lock</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, sales are blocked if quantity exceeds available stock.
                Disable to allow sales even when stock is zero or negative.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={stockLock}
              onClick={() => toggleStockLock(!stockLock)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-trust-blue focus:ring-offset-2 ${
                stockLock ? 'bg-trust-blue' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  stockLock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal open={previewModal.open} onClose={closePreview} title="Sale Receipt Preview" size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Format:</span>
            {['thermal', 'a5', 'a4'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setReceiptFormat(f);
                  if (previewModal.sale) {
                    const html = buildSaleReceiptHtml({
                      sale: previewModal.sale,
                      ledgerName: ledger?.name || previewModal.sale.ledger_name,
                      store,
                      logoDataUrl,
                      format: f,
                    });
                    setPreviewModal((prev) => ({ ...prev, html }));
                  }
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                  receiptFormat === f
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'thermal' ? 'Thermal 80mm' : f.toUpperCase()}
              </button>
            ))}
          </div>
          <iframe
            ref={previewIframeRef}
            srcDoc={previewModal.html}
            title="Sale Receipt Preview"
            className="w-full border border-slate-200 rounded bg-white"
            style={{ minHeight: 380, maxHeight: 600, overflowX: 'hidden' }}
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc) e.target.style.height = Math.min(doc.body.scrollHeight + 8, 600) + 'px';
            }}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closePreview} className="btn-secondary">Close</button>
            <button
              type="button"
              onClick={() => previewIframeRef.current?.contentWindow?.print()}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
