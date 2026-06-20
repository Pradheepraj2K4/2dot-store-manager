import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
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

const FIELD_ORDER = ['itemName', 'unit', 'rate', 'qty', 'discount'];

// localStorage key for the in-progress (new) sale entry, so partially filled
// data survives navigating to another menu and back.
const SALE_DRAFT_KEY = 'item_sale_entry_draft';

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function computeAmount({ rate, quantity, discount_percent, gst_percent }, taxMode = 'inclusive') {
  const r = parseFloat(rate) || 0;
  const q = parseFloat(quantity) || 1;
  const d = parseFloat(discount_percent) || 0;
  const g = parseFloat(gst_percent) || 0;
  const gross = r * q * (1 - d / 100);
  // 'taxable'  : the rate is the pre-tax value, so GST is added on top.
  // 'inclusive': the rate already contains GST, so the amount is the gross
  //              and the tax portion is extracted for display only.
  const amount = taxMode === 'taxable' ? gross * (1 + g / 100) : gross;
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
    original_quantity: 0,
    imeis: [],
  };
}

// Max quantity that can be entered on a line without driving stock negative.
// For an edited line, the previously-saved quantity is added back since
// reversing the old line on save returns that stock.
function maxQtyFor(line) {
  if (!line.item_id || line.current_stock == null) return Infinity;
  return (parseFloat(line.current_stock) || 0) + (parseFloat(line.original_quantity) || 0);
}

function ItemNameCell({ value, items, onSelect, onChange, registerRef, onKeyEnter, onAddNew, onKeyBack }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
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
      }
      setOpen(false);
      onKeyEnter();
    } else if (e.key === 'ArrowLeft' && !value) {
      e.preventDefault();
      onKeyBack?.();
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

// Quantity cell for sales with an inline IMEI picker. When IMEI tracking is on
// and a linked item is selected, focusing the quantity opens a dropdown listing
// the IMEIs still available for that item; the operator picks exactly `qty` of
// them. IMEIs already chosen on other lines (or sold) are not offered.
function ImeiSaleQtyCell({
  enabled,
  itemId,
  quantity,
  selected,
  pool,
  usedElsewhere,
  onQuantityChange,
  onSelectedChange,
  onOpen,
  registerRef,
  onKeyEnter,
  onKeyBack,
  invalid,
  stockTitle,
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => { registerRef(inputRef); }, [registerRef]);

  const qty = Math.max(0, Math.floor(parseFloat(quantity) || 0));
  const sel = Array.isArray(selected) ? selected : [];
  const showPanel = enabled && Boolean(itemId);

  // Options = currently-selected IMEIs (kept visible, e.g. in edit mode) plus
  // the available pool, minus those chosen on other lines.
  const options = useMemo(() => {
    const used = usedElsewhere || new Set();
    const avail = (pool || []).filter((imei) => !used.has(imei));
    return Array.from(new Set([...sel, ...avail]));
  }, [pool, usedElsewhere, sel]);

  // Apply the search filter (case-insensitive substring match).
  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((imei) => String(imei).toLowerCase().includes(q));
  }, [options, query]);

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

  const openPanel = () => {
    setOpen(true);
    setQuery('');
    onOpen?.();
  };

  const toggle = (imei) => {
    const isSel = sel.includes(imei);
    if (isSel) {
      onSelectedChange(sel.filter((s) => s !== imei));
    } else {
      if (sel.length >= qty) return; // cannot exceed quantity
      onSelectedChange([...sel, imei]);
    }
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === 'ArrowDown' && showPanel) {
      e.preventDefault();
      openPanel();
      setTimeout(() => searchRef.current?.focus(), 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onKeyEnter();
    } else if (e.key === 'ArrowLeft' && !quantity) {
      e.preventDefault();
      onKeyBack?.();
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If exactly one option matches, toggle it for quick keyboard selection.
      if (visibleOptions.length === 1) {
        toggle(visibleOptions[0]);
        setQuery('');
      } else {
        optionRefs.current[0]?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  const handleOptionKeyDown = (e, i, imei) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (i < visibleOptions.length - 1) optionRefs.current[i + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i > 0) optionRefs.current[i - 1]?.focus();
      else searchRef.current?.focus();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.key === 'Enter' && sel.length >= qty) {
        // Selection complete — move on to the next column.
        setOpen(false);
        onKeyEnter();
        return;
      }
      toggle(imei);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.focus();
    }
  };

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
        onFocus={() => { if (showPanel) openPanel(); }}
        onKeyDown={handleQtyKeyDown}
        className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-1 ${
          invalid
            ? 'border-debit-red focus:border-debit-red focus:ring-debit-red'
            : 'border-slate-200 focus:border-trust-blue focus:ring-trust-blue'
        }`}
        placeholder="1"
        title={stockTitle}
      />

      {showPanel && open && anchorRect && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: Math.max(8, anchorRect.right - 260),
            width: 260,
            zIndex: 1000,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg p-2"
        >
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-600">Select IMEIs to sell</span>
            <span className={`text-[10px] ${sel.length === qty ? 'text-credit-green' : 'text-slate-400'}`}>{sel.length}/{qty}</span>
          </div>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search IMEI…"
            className="w-full mb-1.5 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:ring-1 focus:border-trust-blue focus:ring-trust-blue"
          />
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {options.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-slate-400">
                No IMEIs available for this item.
              </div>
            ) : visibleOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-slate-400">
                No IMEIs match “{query}”.
              </div>
            ) : (
              visibleOptions.map((imei, i) => {
                const checked = sel.includes(imei);
                const disabled = !checked && sel.length >= qty;
                return (
                  <button
                    type="button"
                    key={imei}
                    ref={(el) => { optionRefs.current[i] = el; }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(imei)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i, imei)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded border ${
                      checked
                        ? 'border-trust-blue bg-trust-blue/10 text-slate-800'
                        : disabled
                          ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'border-slate-100 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? 'border-trust-blue bg-trust-blue text-white' : 'border-slate-300'}`}>
                      {checked ? '✓' : ''}
                    </span>
                    <span className="font-mono truncate">{imei}</span>
                  </button>
                );
              })
            )}
          </div>
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
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerPlace, setCustomerPlace] = useState('');
  const [billDiscount, setBillDiscount] = useState('0');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [imeiEnabled, setImeiEnabled] = useState(false);
  // Cache of available (in-stock) IMEIs per item id, fetched lazily.
  const [availableImeis, setAvailableImeis] = useState({});
  // When a save is attempted with missing IMEIs, highlight the offending rows
  // until the operator selects the required count. Cleared once valid.
  const [showImeiErrors, setShowImeiErrors] = useState(false);

  // CASH walk-in sales capture the buyer's name/mobile inline since they are
  // all billed against the shared system CASH ledger.
  const isCashLedger = ledger?.name === 'CASH';

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

  // Rate tax treatment: 'inclusive' (rate includes GST) or 'taxable' (rate is
  // pre-tax and GST is added on top). Defaults to inclusive.
  const [rateTaxMode, setRateTaxMode] = useState(() => {
    const v = localStorage.getItem('sales_rate_tax_mode');
    return v === 'taxable' ? 'taxable' : 'inclusive';
  });

  const setRateTaxModePersist = (val) => {
    setRateTaxMode(val);
    localStorage.setItem('sales_rate_tax_mode', val);
  };

  // Ctrl+I opens settings dialog; F10 → purchase report
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        setSettingsOpen((o) => !o);
      }
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/purchase-report');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

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

  // Refs for the walk-in customer fields so we can chain focus from the
  // empty item row into them (name -> mobile -> place).
  const customerNameRef = useRef(null);
  const customerMobileRef = useRef(null);
  const customerPlaceRef = useRef(null);

  // Draft persistence: track when the saved draft has been restored (so the
  // auto-save effect doesn't clobber it) and whether it supplied a ledger (so
  // the default-CASH fallback doesn't override the restored selection).
  const draftLoaded = useRef(false);
  const draftLedgerRestored = useRef(false);

  const refreshItems = useCallback(async () => {
    try {
      const res = await itemApi.getAll();
      setItems(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

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
  // Restore a partially-filled new sale when returning to this page, and
  // auto-save changes so switching to another menu doesn't lose the data.
  useEffect(() => {
    if (isEdit) { draftLoaded.current = true; return; }
    try {
      const raw = localStorage.getItem(SALE_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.ledger) { setLedger(d.ledger); draftLedgerRestored.current = true; }
        if (d.date) setDate(d.date);
        if (d.time != null) setTime(d.time);
        if (d.notes != null) setNotes(d.notes);
        if (d.customerName != null) setCustomerName(d.customerName);
        if (d.customerMobile != null) setCustomerMobile(d.customerMobile);
        if (d.customerPlace != null) setCustomerPlace(d.customerPlace);
        if (d.billDiscount != null) setBillDiscount(d.billDiscount);
        if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
      }
    } catch (_) { /* ignore malformed draft */ }
    draftLoaded.current = true;
  }, [isEdit]);

  useEffect(() => {
    if (isEdit || !draftLoaded.current) return;
    const meaningful =
      (customerName && customerName.trim()) ||
      (customerMobile && customerMobile.trim()) ||
      (customerPlace && customerPlace.trim()) ||
      (notes && notes.trim()) ||
      lines.some((l) => l.item_name && l.item_name.trim());
    try {
      if (meaningful) {
        localStorage.setItem(SALE_DRAFT_KEY, JSON.stringify({
          ledger, date, time, notes,
          customerName, customerMobile, customerPlace,
          billDiscount, lines,
        }));
      } else {
        localStorage.removeItem(SALE_DRAFT_KEY);
      }
    } catch (_) { /* ignore storage quota errors */ }
  }, [isEdit, ledger, date, time, notes, customerName, customerMobile, customerPlace, billDiscount, lines]);

  // Fetch (and cache) the in-stock IMEIs for an item so the picker can offer
  // them. Re-fetches on demand to reflect units sold in other tabs.
  const loadImeis = useCallback(async (itemId, { force = false } = {}) => {
    if (!itemId) return;
    if (!force && availableImeis[itemId]) return;
    try {
      const res = await itemApi.getImeis(itemId);
      const list = (res.data || []).map((r) => r.imei);
      setAvailableImeis((prev) => ({ ...prev, [itemId]: list }));
    } catch (_) { /* non-critical */ }
  }, [availableImeis]);

  useEffect(() => {
    refreshItems();
    if (!isEdit) {
      saleApi.getNextNumber().then((r) => setSaleNumber(r.data?.sale_number || '')).catch(() => {});
      ledgerApi.getCash().then((r) => { if (r.data && !draftLedgerRestored.current) setLedger(r.data); }).catch(() => {});
    }
  }, [refreshItems, isEdit]);

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
        setCustomerName(sale.customer_name || '');
        setCustomerMobile(sale.customer_mobile || '');
        setCustomerPlace(sale.customer_place || '');
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
            imeis: Array.isArray(l.imeis) ? l.imeis : [],
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
          rate: String(newItem.sales_rate != null ? newItem.sales_rate : (newItem.mrp || '')),
          quantity: '1',
          gst_percent: newItem.gst_percent ? String(newItem.gst_percent) : '',
          amount: computeAmount({ rate: newItem.sales_rate != null ? newItem.sales_rate : newItem.mrp, quantity: 1, discount_percent: 0, gst_percent: newItem.gst_percent || 0 }, rateTaxMode),
        };
        return next;
      });
    } catch (_) { /* noop */ }
  }, [location.key, refreshItems]);

  // Recompute every line amount when the rate tax treatment changes so the
  // grid reflects the newly selected inclusive / taxable behaviour.
  useEffect(() => {
    setLines((prev) => prev.map((l) => ({ ...l, amount: computeAmount(l, rateTaxMode) })));
  }, [rateTaxMode]);

  const updateLine = (idx, patch) => {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      merged.amount = computeAmount(merged, rateTaxMode);
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

  // Drop any empty (no item selected) rows. Used when focus moves to the
  // customer fields so trailing blank rows don't clutter the bill.
  const pruneEmptyLines = () => {
    setLines((prev) => {
      const filled = prev.filter((l) => l.item_id);
      return filled.length > 0 ? filled : [emptyLine()];
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
    const stock = Number(item.current_stock ?? 0);
    if (stockLock && stock <= 0) {
      toast.error(`"${item.name}" is out of stock`);
      return;
    }
    const defaultRate = item.sales_rate != null ? item.sales_rate : (item.mrp || 0);
    updateLine(idx, {
      item_id: item.id,
      item_name: item.name,
      unit: item.unit || DEFAULT_ITEM_UNIT,
      mrp: item.mrp || 0,
      rate: String(defaultRate),
      quantity: '1',
      gst_percent: item.gst_percent ? String(item.gst_percent) : '',
      current_stock: stock,
      original_quantity: 0,
      imeis: [],
    });
    if (imeiEnabled && (item.imei_enabled === 1 || item.imei_enabled === true)) {
      loadImeis(item.id, { force: true });
    }
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
    // Trim any IMEI selection that now exceeds the reduced quantity.
    const qty = Math.floor(parseFloat(value) || 0);
    const patch = { quantity: value };
    if (imeiEnabled && Array.isArray(line.imeis) && line.imeis.length > qty) {
      patch.imeis = line.imeis.slice(0, qty);
    }
    updateLine(idx, patch);
  };

  const handleCellBack = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    if (currentIdx > 0) {
      focusCell(rowIdx, FIELD_ORDER[currentIdx - 1]);
    } else if (rowIdx > 0) {
      focusCell(rowIdx - 1, FIELD_ORDER[FIELD_ORDER.length - 1]);
    }
  };

  const handleCellEnter = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    if (currentIdx < FIELD_ORDER.length - 1) {
      focusCell(rowIdx, FIELD_ORDER[currentIdx + 1]);
    } else {
      // Last field (discount) — decide whether to add a new row or jump to
      // the walk-in customer fields.
      const currentLine = lines[rowIdx];
      const hasCompleteRow = lines.some((l) => l.item_id);
      // On the trailing empty row (no item selected) once at least one item
      // row is complete, Enter moves into the customer fields instead of
      // creating yet another blank row.
      if (currentLine && !currentLine.item_id && hasCompleteRow && customerNameRef.current) {
        setTimeout(() => customerNameRef.current?.focus(), 0);
        return;
      }
      // Last field (discount) — add new row and focus its item name
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
    const grossTotal = lines.reduce(
      (s, l) => s + (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1),
      0
    );
    const gstTotal = lines.reduce((s, l) => {
      const r = parseFloat(l.rate) || 0;
      const q = parseFloat(l.quantity) || 1;
      const d = parseFloat(l.discount_percent) || 0;
      const g = parseFloat(l.gst_percent) || 0;
      const gross = r * q * (1 - d / 100);
      // 'taxable': GST added on top; 'inclusive': GST embedded in the gross.
      const gst = rateTaxMode === 'taxable'
        ? gross * g / 100
        : gross - gross / (1 + g / 100);
      return s + Math.round(gst * 100) / 100;
    }, 0);
    const discountTotal = lines.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const d = parseFloat(l.discount_percent) || 0;
      return s + gross * d / 100;
    }, 0);
    const lineCount = lines.filter((l) => l.item_name && l.item_name.trim()).length;
    return { total, discountTotal, gstTotal, lineCount };
  }, [lines, rateTaxMode]);

  const netTotal = Math.max(0, totals.total - (parseFloat(billDiscount) || 0));

  // Derives stock + cost info for the currently focused item row.
  const focusedItemInfo = useMemo(() => {
    if (focusedRow == null) return null;
    const line = lines[focusedRow];
    if (!line?.item_id) return null;
    const item = items.find((it) => it.id === line.item_id);
    if (!item) return null;
    const stock = Number(item.current_stock ?? line.current_stock ?? 0);
    let cost = null;
    if (item.last_purchase_rate != null) {
      const gst = item.last_purchase_gst || 0;
      cost = {
        costRate: item.last_purchase_rate * (1 + gst / 100),
        gst,
        baseRate: item.last_purchase_rate,
      };
    }
    return { name: item.name || line.item_name, unit: line.unit, stock, cost, imeis: Array.isArray(line.imeis) ? line.imeis : [] };
  }, [focusedRow, lines, items]);

  // A line needs IMEI selection only when the IMEI module is enabled AND the
  // selected item has been flagged "IMEI Enable" in its master record.
  const itemImeiTracked = (line) => {
    if (!imeiEnabled || !line?.item_id) return false;
    const it = items.find((x) => x.id === line.item_id);
    return Boolean(it && (it.imei_enabled === 1 || it.imei_enabled === true));
  };

  const handleSave = async () => {
    if (!ledger) { toast.error('Select a customer ledger'); return; }
    const validLines = lines.filter((l) => l.item_name && l.item_name.trim());
    if (validLines.length === 0) { toast.error('Add at least one item line'); return; }

    if (isCashLedger && customerMobile && customerMobile.length !== 10) {
      toast.error('Customer mobile must be exactly 10 digits');
      customerMobileRef.current?.focus();
      return;
    }

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

    // IMEI selection check — for every IMEI-enabled item line, the operator
    // must select exactly `qty` IMEIs.
    if (imeiEnabled) {
      let firstBad = -1;
      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i];
        if (!itemImeiTracked(l)) continue;
        const sel = Array.isArray(l.imeis) ? l.imeis.filter(Boolean) : [];
        const qty = Math.floor(parseFloat(l.quantity) || 0);
        if (sel.length !== qty) { firstBad = i; break; }
      }
      if (firstBad >= 0) {
        const l = validLines[firstBad];
        const sel = Array.isArray(l.imeis) ? l.imeis.filter(Boolean) : [];
        const qty = Math.floor(parseFloat(l.quantity) || 0);
        setShowImeiErrors(true);
        toast.error(`Row ${firstBad + 1}: select ${qty} IMEI${qty === 1 ? '' : 's'} for "${l.item_name}" (selected ${sel.length})`);
        return;
      }
      setShowImeiErrors(false);
    }

    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger.id,
        date,
        time,
        notes,
        customer_name: isCashLedger ? customerName.trim() : '',
        customer_mobile: isCashLedger ? customerMobile.trim() : '',
        customer_place: isCashLedger ? customerPlace.trim() : '',
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
          rate_tax_mode: rateTaxMode,
          imeis: itemImeiTracked(l)
            ? (Array.isArray(l.imeis) ? l.imeis.map((s) => String(s || '').trim()).filter(Boolean) : [])
            : [],
        })),
      };
      const res = isEdit
        ? await saleApi.update(saleIdParam, payload)
        : await saleApi.create(payload);
      toast.success(isEdit ? 'Sale updated' : `Sale ${res.data.sale_number} saved`);
      if (res.data) {
        openSalePreview(res.data, ledger?.name, false);
      }
      if (!isEdit) {
        localStorage.removeItem(SALE_DRAFT_KEY);
        setLedger(null);
        setDate(todayISO());
        setTime(nowHHMM());
        setNotes('');
        setCustomerName('');
        setCustomerMobile('');
        setCustomerPlace('');
        setBillDiscount('0');
        setLines([emptyLine()]);
        saleApi.getNextNumber()
          .then((r) => setSaleNumber(r.data?.sale_number || ''))
          .catch(() => {});
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

  // Clear the cached draft and reset the form to a fresh, empty entry.
  const handleResetDraft = () => {
    localStorage.removeItem(SALE_DRAFT_KEY);
    draftLedgerRestored.current = false;
    setLedger(null);
    setDate(todayISO());
    setTime(nowHHMM());
    setNotes('');
    setCustomerName('');
    setCustomerMobile('');
    setCustomerPlace('');
    setBillDiscount('0');
    setLines([emptyLine()]);
    setShowImeiErrors(false);
    ledgerApi.getCash().then((r) => { if (r.data) setLedger(r.data); }).catch(() => {});
    toast.success('Entry reset');
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

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
            <h1 className="page-title">{isEdit ? 'Edit Sale' : 'Item Sales Entry'}</h1>
            <p className="text-sm text-slate-500">
              Sale {saleNumber || '—'}
            </p>
          </div>
          {!isEdit && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Reset entry (clear cached draft)"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          )}
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-52">
            <label className="text-xs text-slate-500">Customer Ledger *</label>
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
                  placeholder="Search customer…"
                />
              </div>
            </div>
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
                <th className="px-3 py-2 text-right font-semibold text-white w-28">{rateTaxMode === 'taxable' ? 'Taxable rate' : 'Rate(Inc. tax)'}</th>
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
                      onChange={(v) => updateLine(idx, { item_name: v, item_id: null, imeis: [] })}
                      onSelect={(it) => handleSelectItem(idx, it)}
                      registerRef={(ref) => setCellRef(idx, 'itemName', ref)}
                      onKeyEnter={() => handleCellEnter(idx, 'itemName')}
                      onKeyBack={() => handleCellBack(idx, 'itemName')}
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
                        else if (e.key === 'ArrowLeft' && !e.target.value) { e.preventDefault(); handleCellBack(idx, 'rate'); }
                      }}
                      className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ImeiSaleQtyCell
                      enabled={itemImeiTracked(line)}
                      itemId={line.item_id}
                      quantity={line.quantity}
                      selected={line.imeis}
                      pool={line.item_id ? (availableImeis[line.item_id] || []) : []}
                      usedElsewhere={new Set(
                        lines
                          .filter((other, i) => i !== idx && other.item_id === line.item_id)
                          .flatMap((other) => (Array.isArray(other.imeis) ? other.imeis : []))
                      )}
                      onQuantityChange={(v) => handleQuantityChange(idx, v)}
                      onSelectedChange={(arr) => updateLine(idx, { imeis: arr })}
                      onOpen={() => line.item_id && loadImeis(line.item_id)}
                      registerRef={(ref) => setCellRef(idx, 'qty', ref)}
                      onKeyEnter={() => handleCellEnter(idx, 'qty')}
                      onKeyBack={() => handleCellBack(idx, 'qty')}
                      invalid={
                        (Boolean(line.item_id) && parseFloat(line.quantity) > maxQtyFor(line)) ||
                        (showImeiErrors && itemImeiTracked(line) &&
                          (Array.isArray(line.imeis) ? line.imeis.filter(Boolean).length : 0) !==
                            Math.floor(parseFloat(line.quantity) || 0))
                      }
                      stockTitle={line.item_id && line.current_stock != null ? `In stock: ${line.current_stock}` : undefined}
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
                        else if (e.key === 'ArrowLeft' && !e.target.value) { e.preventDefault(); handleCellBack(idx, 'discount'); }
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
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Optional remarks for this sale"
            />
            {isCashLedger && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Customer Name</label>
                  <input
                    type="text"
                    ref={customerNameRef}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onFocus={pruneEmptyLines}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        customerMobileRef.current?.focus();
                      }
                    }}
                    className="input-field"
                    placeholder="Walk-in customer name"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Customer Mobile</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    ref={customerMobileRef}
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onFocus={pruneEmptyLines}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        customerPlaceRef.current?.focus();
                      }
                    }}
                    className={`input-field ${customerMobile && customerMobile.length !== 10 ? 'border-red-400' : ''}`}
                    placeholder="Mobile number"
                  />
                  {customerMobile && customerMobile.length !== 10 && (
                    <p className="text-xs text-red-500">Mobile number must be exactly 10 digits.</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Customer Place</label>
                  <input
                    type="text"
                    ref={customerPlaceRef}
                    value={customerPlace}
                    onChange={(e) => setCustomerPlace(e.target.value)}
                    onFocus={pruneEmptyLines}
                    className="input-field"
                    placeholder="Place / location"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5 text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-medium text-slate-700">{totals.lineCount}</span>
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
              <span className="font-bold text-lg text-debit-red">{formatCurrency(netTotal)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-100">
          {/* Footer info — shows stock + cost rate of the focused item row */}
          <div className="flex items-center gap-4 text-xs min-h-[1.5rem]">
            {focusedItemInfo && (
              <>
                <span className="font-medium text-slate-600 truncate max-w-[160px]" title={focusedItemInfo.name}>
                  {focusedItemInfo.name}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Stock:</span>
                  <span className={`font-bold ${focusedItemInfo.stock <= 0 ? 'text-debit-red' : 'text-credit-green'}`}>
                    {focusedItemInfo.stock}
                  </span>
                  {focusedItemInfo.unit && <span className="text-slate-400">{focusedItemInfo.unit}</span>}
                </span>
                {focusedItemInfo.cost && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Cost Rate:</span>
                    <span className="font-bold text-slate-700">{formatCurrency(focusedItemInfo.cost.costRate)}</span>
                    {focusedItemInfo.cost.gst > 0 && (
                      <span className="text-slate-400">
                        ({formatCurrency(focusedItemInfo.cost.baseRate)} + {focusedItemInfo.cost.gst}% GST)
                      </span>
                    )}
                  </span>
                )}
                {imeiEnabled && focusedItemInfo.imeis.length > 0 && (
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="text-slate-400 shrink-0">IMEIs:</span>
                    <span className="flex items-center gap-1 flex-wrap">
                      {focusedItemInfo.imeis.map((imei) => (
                        <span
                          key={imei}
                          className="font-mono px-1.5 py-0.5 rounded bg-trust-blue/10 text-trust-blue border border-trust-blue/20"
                        >
                          {imei}
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
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
      </div>

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

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700">Rate Tax Treatment</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">
              Choose whether the entered rate already includes GST, or is the
              pre-tax (taxable) value with GST added on top.
            </p>
            <div className="flex gap-2">
              {[
                { val: 'inclusive', label: 'Inclusive of tax' },
                { val: 'taxable', label: 'Taxable rate' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setRateTaxModePersist(opt.val)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    rateTaxMode === opt.val
                      ? 'bg-trust-blue text-white border-trust-blue'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
