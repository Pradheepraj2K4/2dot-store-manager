import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { itemApi, saleApi, settingsApi, ledgerApi, waiterApi } from "../../api";
import { DEFAULT_ITEM_UNIT } from "../../utils/itemConstants";
import { formatCurrency, todayISO } from "../../utils/helpers";
import { hasPermission } from "../../utils/auth";
import { buildSaleReceiptHtml } from "../../utils/saleReceipt";
import { fetchLogoDataUrl } from "../../utils/interestReceipt";
import LedgerAutocomplete from "../ui/LedgerAutocomplete";
import CustomerAutocomplete from "../ui/CustomerAutocomplete";
import LoadingSpinner from "../ui/LoadingSpinner";
import Modal from "../ui/Modal";

const FIELD_ORDER = ["itemName", "rate", "qty", "discount"];

// localStorage key for the in-progress (new) sale entry, so partially filled
// data survives navigating to another menu and back.
const SALE_DRAFT_KEY = "item_sale_entry_draft";
// When the multi-counter dev setting is on, up to four independent sale drafts
// are kept side by side. Counter 1 reuses the legacy key (so existing drafts
// carry over); counters 2-4 get their own slots.
const ACTIVE_COUNTER_KEY = "item_sale_active_counter";
const COUNTER_COUNT = 4;
const draftKeyFor = (counter) =>
  counter === 1 ? SALE_DRAFT_KEY : `${SALE_DRAFT_KEY}_${counter}`;

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function computeAmount(
  { rate, quantity, discount_percent, gst_percent },
  taxMode = "inclusive",
) {
  const r = parseFloat(rate) || 0;
  const q = parseFloat(quantity) || 1;
  const d = parseFloat(discount_percent) || 0;
  const g = parseFloat(gst_percent) || 0;
  const gross = r * q * (1 - d / 100);
  // 'taxable'  : the rate is the pre-tax value, so GST is added on top.
  // 'inclusive': the rate already contains GST, so the amount is the gross
  //              and the tax portion is extracted for display only.
  const amount = taxMode === "taxable" ? gross * (1 + g / 100) : gross;
  return Math.round(amount * 100) / 100;
}

function emptyLine() {
  return {
    item_id: null,
    item_name: "",
    unit: DEFAULT_ITEM_UNIT,
    mrp: 0,
    rate: "",
    quantity: "1",
    discount_percent: "",
    gst_percent: "",
    amount: 0,
    current_stock: null,
    original_quantity: 0,
    imeis: [],
    // Restaurant module: retained so a line can be re-priced when the bill's
    // A/C vs Non-A/C service type changes.
    sales_rate: null,
    ac_rate: null,
    non_ac_rate: null,
    // Batch tracking: the specific batch this line draws stock from.
    batch_id: null,
    batch_no: "",
  };
}

// Resolves the rate a line should use for the given service type, falling back
// to the item's sales rate, then MRP, when a fixed A/C / Non-A/C rate is absent.
function rateForServiceType(
  { sales_rate, mrp, ac_rate, non_ac_rate },
  serviceType,
) {
  const base =
    sales_rate != null && sales_rate !== ""
      ? parseFloat(sales_rate)
      : parseFloat(mrp) || 0;
  if (serviceType === "ac") {
    return ac_rate != null && ac_rate !== "" ? parseFloat(ac_rate) : base;
  }
  if (serviceType === "non_ac") {
    return non_ac_rate != null && non_ac_rate !== ""
      ? parseFloat(non_ac_rate)
      : base;
  }
  return base;
}

// Max quantity that can be entered on a line without driving stock negative.
// For an edited line, the previously-saved quantity is added back since
// reversing the old line on save returns that stock.
function maxQtyFor(line) {
  if (!line.item_id || line.current_stock == null) return Infinity;
  return (
    (parseFloat(line.current_stock) || 0) +
    (parseFloat(line.original_quantity) || 0)
  );
}

function ItemNameCell({
  value,
  items,
  onSelect,
  onChange,
  registerRef,
  onKeyEnter,
  onAddNew,
  onKeyBack,
  hideStock,
}) {
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
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = (value || "").toLowerCase().trim();
    if (!q) return items.slice(0, 20);
    return items
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.item_code || "").toLowerCase().includes(q) ||
          (it.brand || "").toLowerCase().includes(q) ||
          (it.category || "").toLowerCase().includes(q) ||
          (it.batch_numbers || "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [items, value]);

  // When the query looks like a batch number, return the specific batch on this
  // item that matches so selecting it can jump straight to that batch.
  const matchedBatchNo = (it) => {
    const q = (value || "").trim().toLowerCase();
    if (!q || !it || !it.batch_numbers) return null;
    const nums = String(it.batch_numbers)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      nums.find((n) => n.toLowerCase() === q) ||
      nums.find((n) => n.toLowerCase().includes(q)) ||
      null
    );
  };

  useEffect(() => {
    setHighlight(-1);
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const typed = (value || "").trim();
      let chosen = null;
      if (open && highlight >= 0 && filtered[highlight]) {
        chosen = filtered[highlight];
      } else if (typed) {
        // No row explicitly highlighted: resolve what the user typed. Prefer an
        // exact item-code match, then an exact name match, then a batch-number
        // match, else the top result so typing a code/batch and hitting Enter
        // selects the item and moves on.
        const q = typed.toLowerCase();
        chosen =
          filtered.find((it) => (it.item_code || "").toLowerCase() === q) ||
          filtered.find((it) => it.name.toLowerCase() === q) ||
          filtered.find((it) => matchedBatchNo(it)) ||
          filtered[0] ||
          null;
      }
      if (typed && !chosen) {
        // Typed text matches no existing item — keep focus here and force the
        // operator to pick a real item or create one before advancing.
        setOpen(true);
        toast.error(
          `"${typed}" is not a saved item. Select one from the list or create it.`,
        );
        return;
      }
      if (chosen) onSelect(chosen, matchedBatchNo(chosen));
      setOpen(false);
      onKeyEnter();
    } else if (e.key === "ArrowLeft" && !value) {
      e.preventDefault();
      onKeyBack?.();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value || ""}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
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

      {open && anchorRect && (value || "").trim() && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
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
                onClick={() => {
                  onSelect(it, matchedBatchNo(it));
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm border-b border-slate-100 last:border-0 hover:bg-trust-blue/20 ${
                  idx === highlight ? "bg-trust-blue/20" : ""
                }`}
              >
                <div className="flex items-center gap-4 whitespace-nowrap">
                  {it.item_code ? (
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {it.item_code}
                    </span>
                  ) : null}
                  <span className="font-medium text-slate-800">{it.name}</span>
                  <span className="text-xs text-slate-400">
                    {[it.brand, it.category].filter(Boolean).join(" · ")}
                  </span>
                  {Number(it.batch_count) > 0 ? (
                    <span className="text-xs text-slate-500">
                      {formatCurrency(
                        it.latest_batch_mrp != null
                          ? it.latest_batch_mrp
                          : it.mrp,
                      )}
                      <span className="ml-1 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700">
                        {matchedBatchNo(it)
                          ? `Batch ${matchedBatchNo(it)}`
                          : Number(it.batch_count) > 1
                            ? `${it.batch_count} batches`
                            : `Batch ${it.latest_batch_no}`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {formatCurrency(it.mrp)}
                    </span>
                  )}
                  {!hideStock && (
                    <span className="ml-auto text-xs font-medium text-slate-600">
                      Stock: {Number(it.current_stock ?? 0)}
                    </span>
                  )}
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
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => {
    registerRef(inputRef);
  }, [registerRef]);

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
      if (inputRef.current)
        setAnchorRect(inputRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, showPanel]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openPanel = () => {
    setOpen(true);
    setQuery("");
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
    if (e.key === "ArrowDown" && showPanel) {
      e.preventDefault();
      openPanel();
      setTimeout(() => searchRef.current?.focus(), 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onKeyEnter();
    } else if (e.key === "ArrowLeft" && !quantity) {
      e.preventDefault();
      onKeyBack?.();
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      // If exactly one option matches, toggle it for quick keyboard selection.
      if (visibleOptions.length === 1) {
        toggle(visibleOptions[0]);
        setQuery("");
      } else {
        optionRefs.current[0]?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  const handleOptionKeyDown = (e, i, imei) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (i < visibleOptions.length - 1) optionRefs.current[i + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i > 0) optionRefs.current[i - 1]?.focus();
      else searchRef.current?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (e.key === "Enter" && sel.length >= qty) {
        // Selection complete — move on to the next column.
        setOpen(false);
        onKeyEnter();
        return;
      }
      toggle(imei);
    } else if (e.key === "Escape") {
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
          if (
            !root.contains(document.activeElement) &&
            !(
              panelRef.current &&
              panelRef.current.contains(document.activeElement)
            )
          ) {
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
        onFocus={() => {
          if (showPanel) openPanel();
        }}
        onKeyDown={handleQtyKeyDown}
        className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-1 ${
          invalid
            ? "border-debit-red focus:border-debit-red focus:ring-debit-red"
            : "border-slate-200 focus:border-trust-blue focus:ring-trust-blue"
        }`}
        placeholder="1"
        title={stockTitle}
      />

      {showPanel && open && anchorRect && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: anchorRect.bottom + 4,
            left: Math.max(8, anchorRect.right - 260),
            width: 260,
            zIndex: 1000,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg p-2"
        >
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-600">
              Select IMEIs to sell
            </span>
            <span
              className={`text-[10px] ${sel.length === qty ? "text-credit-green" : "text-slate-400"}`}
            >
              {sel.length}/{qty}
            </span>
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
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(imei)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i, imei)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded border ${
                      checked
                        ? "border-trust-blue bg-trust-blue/10 text-slate-800"
                        : disabled
                          ? "border-slate-100 text-slate-300 cursor-not-allowed"
                          : "border-slate-100 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? "border-trust-blue bg-trust-blue text-white" : "border-slate-300"}`}
                    >
                      {checked ? "✓" : ""}
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
  const [saleNumber, setSaleNumber] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHHMM());
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerPlace, setCustomerPlace] = useState("");
  // Id of the retained customer once one is picked from the suggestions. Left
  // null for a fresh walk-in — the backend then resolves/creates by mobile.
  const [customerId, setCustomerId] = useState(null);
  const [billDiscount, setBillDiscount] = useState("0");
  // Freight/shipping charge added on top of the bill total. Surfaced only when
  // the developer setting `freight_charge_enabled` is on.
  const [freightCharge, setFreightCharge] = useState("0");
  const [freightEnabled, setFreightEnabled] = useState(false);
  // Split payment: amount tendered in cash vs UPI. The two are kept in sync so
  // they always add up to the bill's net total (see the netTotal effect below).
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  // Physical cash the customer hands over. The change to return is derived as
  // (tendered − cash portion). Blank = tender not separately recorded.
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [imeiEnabled, setImeiEnabled] = useState(false);
  // Batch tracking: when on, selecting an item with multiple batches prompts
  // for a batch and the sale draws stock from that specific batch.
  const [batchEnabled, setBatchEnabled] = useState(false);
  // Active batch-selection prompt: { rowIdx, item, batches } or null.
  const [batchModal, setBatchModal] = useState(null);
  // Cash tender field: when disabled the "Tendered"/"Return" inputs are hidden.
  const [cashTenderEnabled, setCashTenderEnabled] = useState(true);
  // Restaurant module: when enabled the bill can be tagged A/C or Non-A/C and
  // assigned to a waiter, and item lines resolve to the matching fixed rate.
  const [restaurantEnabled, setRestaurantEnabled] = useState(false);
  const [waiters, setWaiters] = useState([]);
  const [waiterId, setWaiterId] = useState("");
  const [serviceType, setServiceType] = useState("non_ac"); // '', 'ac', 'non_ac'
  const [diningType, setDiningType] = useState("dining"); // 'dining', 'take_away'
  // Multi-counter: keep two independent in-progress sales and switch between
  // them mid-entry. Enabled via the developer settings toggle.
  const [multiCounterEnabled, setMultiCounterEnabled] = useState(false);
  const [activeCounter, setActiveCounter] = useState(() => {
    const v = parseInt(localStorage.getItem(ACTIVE_COUNTER_KEY) || "1", 10);
    return v >= 1 && v <= COUNTER_COUNT ? v : 1;
  });
  // Cache of available (in-stock) IMEIs per item id, fetched lazily.
  const [availableImeis, setAvailableImeis] = useState({});
  // When a save is attempted with missing IMEIs, highlight the offending rows
  // until the operator selects the required count. Cleared once valid.
  const [showImeiErrors, setShowImeiErrors] = useState(false);

  // CASH walk-in sales capture the buyer's name/mobile inline since they are
  // all billed against the shared system CASH ledger.
  const isCashLedger = ledger?.name === "CASH";

  // Field-level edit permissions. Admin (and the dev override) always pass;
  // created users need the matching toggle enabled to edit these fields.
  const canEditRate = useMemo(() => hasPermission("edit_rate"), []);
  const canEditBillDiscount = useMemo(
    () => hasPermission("edit_bill_discount"),
    [],
  );

  // ── Row focus tracking for cost-rate tag ────────────────────────
  const [focusedRow, setFocusedRow] = useState(null);
  const [stockLock, setStockLock] = useState(() => {
    const v = localStorage.getItem("sales_stock_lock");
    return v === null ? true : v === "true";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleStockLock = (val) => {
    setStockLock(val);
    localStorage.setItem("sales_stock_lock", String(val));
  };

  // Restaurant items are made-to-order and carry no inventory, so stock is
  // never enforced or displayed while the restaurant module is on.
  const stockEnforced = stockLock && !restaurantEnabled;

  // Rate tax treatment: 'inclusive' (rate includes GST) or 'taxable' (rate is
  // pre-tax and GST is added on top). Defaults to inclusive.
  const [rateTaxMode, setRateTaxMode] = useState(() => {
    const v = localStorage.getItem("sales_rate_tax_mode");
    return v === "taxable" ? "taxable" : "inclusive";
  });

  const setRateTaxModePersist = (val) => {
    setRateTaxMode(val);
    localStorage.setItem("sales_rate_tax_mode", val);
  };

  // Whether the Unit / Discount fields are skipped entirely by Enter-key
  // navigation. When disabled (true), Enter jumps straight over that field to
  // the next one in the chain (e.g. Item Name -> Rate, skipping Unit). Each is
  // independently configurable, defaulting to false (fields included).
  const [disableAutoFocusUnit, setDisableAutoFocusUnit] = useState(() => {
    return localStorage.getItem("sales_disable_autofocus_unit") === "true";
  });
  const [disableAutoFocusRate, setDisableAutoFocusRate] = useState(() => {
    return localStorage.getItem("sales_disable_autofocus_rate") === "true";
  });
  const [disableAutoFocusDiscount, setDisableAutoFocusDiscount] = useState(
    () => {
      return (
        localStorage.getItem("sales_disable_autofocus_discount") === "true"
      );
    },
  );
  // When enabled, Enter on the trailing row (after the last item line) saves
  // the sale directly instead of jumping into the walk-in customer fields.
  const [disableAutoFocusCustomer, setDisableAutoFocusCustomer] = useState(
    () => {
      return (
        localStorage.getItem("sales_disable_autofocus_customer") === "true"
      );
    },
  );

  const toggleDisableAutoFocusUnit = (val) => {
    setDisableAutoFocusUnit(val);
    localStorage.setItem("sales_disable_autofocus_unit", String(val));
  };
  const toggleDisableAutoFocusRate = (val) => {
    setDisableAutoFocusRate(val);
    localStorage.setItem("sales_disable_autofocus_rate", String(val));
  };
  const toggleDisableAutoFocusDiscount = (val) => {
    setDisableAutoFocusDiscount(val);
    localStorage.setItem("sales_disable_autofocus_discount", String(val));
  };
  const toggleDisableAutoFocusCustomer = (val) => {
    setDisableAutoFocusCustomer(val);
    localStorage.setItem("sales_disable_autofocus_customer", String(val));
  };

  // Individual show/hide toggles for the tax & discount summary lines in the
  // totals footer. All default to visible (true).
  const [showCgst, setShowCgst] = useState(() => {
    return localStorage.getItem("sales_show_cgst") !== "false";
  });
  const [showSgst, setShowSgst] = useState(() => {
    return localStorage.getItem("sales_show_sgst") !== "false";
  });
  const [showIgst, setShowIgst] = useState(() => {
    return localStorage.getItem("sales_show_igst") !== "false";
  });
  const [showGst, setShowGst] = useState(() => {
    return localStorage.getItem("sales_show_gst") !== "false";
  });
  const [showItemDiscount, setShowItemDiscount] = useState(() => {
    return localStorage.getItem("sales_show_item_discount") !== "false";
  });

  // Payment-field visibility toggles for the sale entry screen. Default visible.
  // `showCashUpi` hides the whole Cash/UPI payment block; `showCashTender`
  // hides just the Tendered/Return row within it.
  const [showCashUpi, setShowCashUpi] = useState(() => {
    return localStorage.getItem("sales_show_cash_upi") !== "false";
  });
  const [showCashTender, setShowCashTender] = useState(() => {
    return localStorage.getItem("sales_show_cash_tender") !== "false";
  });

  const toggleShowCgst = (val) => {
    setShowCgst(val);
    localStorage.setItem("sales_show_cgst", String(val));
  };
  const toggleShowSgst = (val) => {
    setShowSgst(val);
    localStorage.setItem("sales_show_sgst", String(val));
  };
  const toggleShowIgst = (val) => {
    setShowIgst(val);
    localStorage.setItem("sales_show_igst", String(val));
  };
  const toggleShowGst = (val) => {
    setShowGst(val);
    localStorage.setItem("sales_show_gst", String(val));
  };
  const toggleShowItemDiscount = (val) => {
    setShowItemDiscount(val);
    localStorage.setItem("sales_show_item_discount", String(val));
  };
  const toggleShowCashUpi = (val) => {
    setShowCashUpi(val);
    localStorage.setItem("sales_show_cash_upi", String(val));
  };
  const toggleShowCashTender = (val) => {
    setShowCashTender(val);
    localStorage.setItem("sales_show_cash_tender", String(val));
  };

  // Ctrl+I opens settings dialog; F10 → sales report
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "i") {
        e.preventDefault();
        setSettingsOpen((o) => !o);
      }
      if (e.key === "F10") {
        e.preventDefault();
        navigate("/sales-report");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // ── Receipt / print state ─────────────────────────────────────────────
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState("thermal");
  const [receiptConfig, setReceiptConfig] = useState(null);
  const [printEnabled, setPrintEnabled] = useState(false);
  const [previewModal, setPreviewModal] = useState({
    open: false,
    html: "",
    sale: null,
  });
  const previewIframeRef = useRef(null);
  const printButtonRef = useRef(null);
  const navigateAfterPreviewRef = useRef(false);

  // Load store profile + receipt config + print toggle on mount
  useEffect(() => {
    (async () => {
      const [profileRes, configRes, printRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
        settingsApi
          .get("print_receipts_sale_enabled")
          .catch(() => ({ data: { value: "false" } })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      const cfg =
        configRes.data && typeof configRes.data === "object"
          ? configRes.data
          : {};
      setReceiptConfig(cfg);
      const fmt = cfg.format || "thermal";
      setReceiptFormat(["a4", "a5", "thermal"].includes(fmt) ? fmt : "thermal");
      const pv = printRes.data?.value;
      setPrintEnabled(pv === true || pv === "true");
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
  const cashInputRef = useRef(null);
  const upiInputRef = useRef(null);
  const tenderedInputRef = useRef(null);

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
    settingsApi
      .get("imei_tracking_enabled")
      .then((r) => {
        const v = r.data?.value;
        setImeiEnabled(v === true || v === "true");
      })
      .catch(() => {});
  }, []);

  // Load the purchase-batch toggle once on mount.
  useEffect(() => {
    settingsApi
      .get("purchase_batch_enabled")
      .then((r) => {
        const v = r.data?.value;
        setBatchEnabled(v === true || v === "true");
      })
      .catch(() => {});
  }, []);

  // Load the cash-tender toggle once on mount (default enabled).
  useEffect(() => {
    settingsApi
      .get("cash_tender_enabled")
      .then((r) => {
        const v = r.data?.value;
        setCashTenderEnabled(v !== false && v !== "false");
      })
      .catch(() => {});
  }, []);

  // Load the freight-charge toggle once on mount.
  useEffect(() => {
    settingsApi
      .get("freight_charge_enabled")
      .then((r) => {
        const v = r.data?.value;
        setFreightEnabled(v === true || v === "true");
      })
      .catch(() => {});
  }, []);

  // Load the restaurant module flag and, when enabled, the waiter list.
  useEffect(() => {
    settingsApi
      .get("restaurant_module_enabled")
      .then((r) => {
        const v = r.data?.value;
        const enabled = v === true || v === "true";
        setRestaurantEnabled(enabled);
        if (enabled) {
          waiterApi
            .getAll({ status: "active" })
            .then((res) => {
              const list = res.data || [];
              setWaiters(list);
              // Pre-select the default waiter for a brand-new bill, without
              // clobbering an existing selection (edit mode or restored draft).
              if (!isEdit) {
                const def = list.find((w) => w.is_default);
                if (def) setWaiterId((prev) => prev || String(def.id));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [isEdit]);

  // Load the multi-counter flag. When disabled, always fall back to counter 1.
  useEffect(() => {
    settingsApi
      .get("multi_counter_enabled")
      .then((r) => {
        const v = r.data?.value;
        const enabled = v === true || v === "true";
        setMultiCounterEnabled(enabled);
        if (!enabled) {
          setActiveCounter(1);
          localStorage.setItem(ACTIVE_COUNTER_KEY, "1");
        }
      })
      .catch(() => {});
  }, []);

  // ── Draft persistence ───────────────────────────────────────────
  // Restore a partially-filled new sale when returning to this page, and
  // auto-save changes so switching to another menu doesn't lose the data.
  const applyDraftData = (d) => {
    if (d.ledger) {
      setLedger(d.ledger);
      draftLedgerRestored.current = true;
    }
    if (d.date) setDate(d.date);
    if (d.time != null) setTime(d.time);
    if (d.notes != null) setNotes(d.notes);
    if (d.customerName != null) setCustomerName(d.customerName);
    if (d.customerMobile != null) setCustomerMobile(d.customerMobile);
    if (d.customerPlace != null) setCustomerPlace(d.customerPlace);
    if (d.customerId != null) setCustomerId(d.customerId);
    if (d.billDiscount != null) setBillDiscount(d.billDiscount);
    if (d.freightCharge != null) setFreightCharge(d.freightCharge);
    if (d.waiterId != null) setWaiterId(d.waiterId);
    if (d.serviceType != null) setServiceType(d.serviceType);
    if (d.diningType != null) setDiningType(d.diningType);
    if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
  };

  useEffect(() => {
    if (isEdit) {
      draftLoaded.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(draftKeyFor(activeCounter));
      if (raw) applyDraftData(JSON.parse(raw));
    } catch (_) {
      /* ignore malformed draft */
    }
    draftLoaded.current = true;
    // Only run on mount; counter switches are handled by switchCounter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        localStorage.setItem(
          draftKeyFor(activeCounter),
          JSON.stringify({
            ledger,
            date,
            time,
            notes,
            customerName,
            customerMobile,
            customerPlace,
            customerId,
            billDiscount,
            freightCharge,
            waiterId,
            serviceType,
            diningType,
            lines,
          }),
        );
      } else {
        localStorage.removeItem(draftKeyFor(activeCounter));
      }
    } catch (_) {
      /* ignore storage quota errors */
    }
  }, [
    isEdit,
    activeCounter,
    ledger,
    date,
    time,
    notes,
    customerName,
    customerMobile,
    customerPlace,
    customerId,
    billDiscount,
    freightCharge,
    waiterId,
    serviceType,
    diningType,
    lines,
  ]);

  // Switch between the two sale counters, persisting the current one and
  // loading the target's saved draft (or a fresh blank entry).
  const switchCounter = (target) => {
    if (target === activeCounter || isEdit) return;
    // Persist the current counter explicitly so switching never loses data.
    const meaningful =
      (customerName && customerName.trim()) ||
      (customerMobile && customerMobile.trim()) ||
      (customerPlace && customerPlace.trim()) ||
      (notes && notes.trim()) ||
      lines.some((l) => l.item_name && l.item_name.trim());
    try {
      if (meaningful) {
        localStorage.setItem(
          draftKeyFor(activeCounter),
          JSON.stringify({
            ledger,
            date,
            time,
            notes,
            customerName,
            customerMobile,
            customerPlace,
            customerId,
            billDiscount,
            freightCharge,
            waiterId,
            serviceType,
            diningType,
            lines,
          }),
        );
      } else {
        localStorage.removeItem(draftKeyFor(activeCounter));
      }
    } catch (_) {
      /* ignore */
    }

    setActiveCounter(target);
    localStorage.setItem(ACTIVE_COUNTER_KEY, String(target));

    // Reset the form, then load the target counter's draft if it has one.
    draftLedgerRestored.current = false;
    setLedger(null);
    setDate(todayISO());
    setTime(nowHHMM());
    setNotes("");
    setCustomerName("");
    setCustomerMobile("");
    setCustomerPlace("");
    setCustomerId(null);
    setBillDiscount("0");
    setFreightCharge("0");
    setCashAmount("");
    setUpiAmount("");
    setTenderedAmount("");
    setWaiterId("");
    setServiceType("non_ac");
    setDiningType("dining");
    setLines([emptyLine()]);
    setShowImeiErrors(false);
    let restored = false;
    try {
      const raw = localStorage.getItem(draftKeyFor(target));
      if (raw) {
        applyDraftData(JSON.parse(raw));
        restored = true;
      }
    } catch (_) {
      /* ignore */
    }
    if (!restored) {
      ledgerApi
        .getCash()
        .then((r) => {
          if (r.data) setLedger(r.data);
        })
        .catch(() => {});
    }
    toast.success(`Switched to Counter ${target}`);
  };

  // F2 cycles through the sale counters (multi-counter mode only).
  useEffect(() => {
    if (!multiCounterEnabled || isEdit) return;
    const handler = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        switchCounter((activeCounter % COUNTER_COUNT) + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [multiCounterEnabled, isEdit, activeCounter, switchCounter]);

  // Fetch (and cache) the in-stock IMEIs for an item so the picker can offer
  // them. Re-fetches on demand to reflect units sold in other tabs.
  const loadImeis = useCallback(
    async (itemId, { force = false } = {}) => {
      if (!itemId) return;
      if (!force && availableImeis[itemId]) return;
      try {
        const res = await itemApi.getImeis(itemId);
        const list = (res.data || []).map((r) => r.imei);
        setAvailableImeis((prev) => ({ ...prev, [itemId]: list }));
      } catch (_) {
        /* non-critical */
      }
    },
    [availableImeis],
  );

  useEffect(() => {
    refreshItems();
    if (!isEdit) {
      saleApi
        .getNextNumber()
        .then((r) => setSaleNumber(r.data?.sale_number || ""))
        .catch(() => {});
      ledgerApi
        .getCash()
        .then((r) => {
          if (r.data && !draftLedgerRestored.current) setLedger(r.data);
        })
        .catch(() => {});
    }
  }, [refreshItems, isEdit]);

  // Focus the first item-name field by default when the page opens.
  useEffect(() => {
    focusCell(0, "itemName");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When every item row is empty and nothing is focused, typing a letter
  // jumps into the first item-name field seeded with that character.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      if (previewModal.open) return;
      const ae = document.activeElement;
      if (ae && ae !== document.body) return;
      const allEmpty = lines.every(
        (l) => !l.item_id && !(l.item_name && l.item_name.trim()),
      );
      if (!allEmpty) return;
      e.preventDefault();
      updateLine(0, { item_name: e.key, item_id: null, imeis: [] });
      focusCell(0, "itemName");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, previewModal.open]);

  // When returning from the ledger-creation page (opened via the '+' button),
  // auto-select the freshly created ledger.
  useEffect(() => {
    const newLedgerId = location.state?.newLedgerId;
    if (!newLedgerId) return;
    ledgerApi
      .getById(newLedgerId)
      .then((r) => {
        if (r.data) setLedger(r.data);
      })
      .catch(() => {})
      .finally(() => {
        navigate(location.pathname + location.search, {
          replace: true,
          state: {},
        });
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
        const patch = {};
        if (l.current_stock !== stock) patch.current_stock = stock;
        // Backfill the master rates so a loaded (edit-mode) line can be
        // re-priced when the A/C / Non-A/C service type changes.
        if (l.sales_rate == null && item.sales_rate != null)
          patch.sales_rate = item.sales_rate;
        if (l.ac_rate == null && item.ac_rate != null)
          patch.ac_rate = item.ac_rate;
        if (l.non_ac_rate == null && item.non_ac_rate != null)
          patch.non_ac_rate = item.non_ac_rate;
        if (Object.keys(patch).length === 0) return l;
        changed = true;
        return { ...l, ...patch };
      });
      return changed ? next : prev;
    });
  }, [items]);

  // Load existing sale (edit mode)
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    saleApi
      .getById(saleIdParam)
      .then((res) => {
        const sale = res.data;
        setSaleNumber(sale.sale_number);
        setDate(sale.date);
        setTime(sale.time || "");
        setNotes(sale.notes || "");
        setCustomerName(sale.customer_name || "");
        setCustomerMobile(sale.customer_mobile || "");
        setCustomerPlace(sale.customer_place || "");
        setCustomerId(sale.customer_id || null);
        setBillDiscount(
          sale.bill_discount != null ? String(sale.bill_discount) : "0",
        );
        setFreightCharge(
          sale.freight_charge != null ? String(sale.freight_charge) : "0",
        );
        setCashAmount(sale.cash_amount != null ? String(sale.cash_amount) : "");
        setUpiAmount(sale.upi_amount ? String(sale.upi_amount) : "");
        setTenderedAmount(
          sale.tendered_amount ? String(sale.tendered_amount) : "",
        );
        setWaiterId(sale.waiter_id != null ? String(sale.waiter_id) : "");
        setServiceType(sale.service_type || "");
        setDiningType(sale.dining_type || "dining");
        setLedger({
          id: sale.ledger_id,
          name: sale.ledger_name,
          behaviour: "customer",
        });
        setLines(
          (sale.items || []).map((l) => ({
            item_id: l.item_id,
            item_name: l.item_name,
            unit: l.unit || DEFAULT_ITEM_UNIT,
            mrp: l.mrp || 0,
            rate: String(l.rate),
            quantity: String(l.quantity ?? 1),
            discount_percent: l.discount_percent
              ? String(l.discount_percent)
              : "",
            gst_percent: l.gst_percent ? String(l.gst_percent) : "",
            amount: l.amount,
            current_stock: null,
            original_quantity: parseFloat(l.quantity) || 0,
            imeis: Array.isArray(l.imeis) ? l.imeis : [],
            sales_rate: null,
            ac_rate: null,
            non_ac_rate: null,
            batch_id: l.batch_id != null ? l.batch_id : null,
            batch_no: l.batch_no || "",
          })),
        );
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, saleIdParam]);

  // After returning from the item creation page, pick up the newly created item.
  useEffect(() => {
    const raw = sessionStorage.getItem("lastCreatedItem");
    if (!raw) return;
    sessionStorage.removeItem("lastCreatedItem");
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
          rate: String(rateForServiceType(newItem, serviceType) || ""),
          quantity: "1",
          gst_percent: newItem.gst_percent ? String(newItem.gst_percent) : "",
          amount: computeAmount(
            {
              rate: rateForServiceType(newItem, serviceType),
              quantity: 1,
              discount_percent: 0,
              gst_percent: newItem.gst_percent || 0,
            },
            rateTaxMode,
          ),
          sales_rate: newItem.sales_rate != null ? newItem.sales_rate : null,
          ac_rate: newItem.ac_rate != null ? newItem.ac_rate : null,
          non_ac_rate: newItem.non_ac_rate != null ? newItem.non_ac_rate : null,
        };
        return next;
      });
    } catch (_) {
      /* noop */
    }
  }, [location.key, refreshItems, serviceType]);

  // Recompute every line amount when the rate tax treatment changes so the
  // grid reflects the newly selected inclusive / taxable behaviour.
  useEffect(() => {
    setLines((prev) =>
      prev.map((l) => ({ ...l, amount: computeAmount(l, rateTaxMode) })),
    );
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

  // Restaurant module: switching the bill's A/C / Non-A/C service type re-prices
  // every item line to the matching fixed rate (falling back to sales rate / MRP).
  const handleServiceTypeChange = (type) => {
    setServiceType(type);
    setLines((prev) =>
      prev.map((l) => {
        if (!l.item_id) return l;
        const rate = rateForServiceType(l, type);
        const merged = { ...l, rate: String(rate) };
        merged.amount = computeAmount(merged, rateTaxMode);
        return merged;
      }),
    );
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
      focusCell(emptyIdx, "itemName");
      return;
    }
    setLines((prev) => [...prev, emptyLine()]);
    setTimeout(() => focusCell(lines.length, "itemName"), 0);
  };

  // Builds the line patch for a selected item, optionally overriding price and
  // stock with a chosen batch's values.
  const buildLinePatch = (item, batch) => {
    const mrp = batch ? parseFloat(batch.mrp) || 0 : item.mrp || 0;
    const salesRate = batch
      ? batch.sales_rate != null
        ? batch.sales_rate
        : item.sales_rate != null
          ? item.sales_rate
          : null
      : item.sales_rate != null
        ? item.sales_rate
        : null;
    const defaultRate = rateForServiceType(
      {
        sales_rate: salesRate,
        mrp,
        ac_rate: item.ac_rate,
        non_ac_rate: item.non_ac_rate,
      },
      serviceType,
    );
    const gst =
      batch && batch.gst_percent ? batch.gst_percent : item.gst_percent;
    const stock = batch
      ? Number(batch.current_stock ?? 0)
      : Number(item.current_stock ?? 0);
    return {
      item_id: item.id,
      item_name: item.name,
      unit: item.unit || DEFAULT_ITEM_UNIT,
      mrp,
      rate: String(defaultRate),
      quantity: "1",
      gst_percent: gst ? String(gst) : "",
      current_stock: stock,
      original_quantity: 0,
      imeis: [],
      sales_rate: salesRate,
      ac_rate: item.ac_rate != null ? item.ac_rate : null,
      non_ac_rate: item.non_ac_rate != null ? item.non_ac_rate : null,
      batch_id: batch ? batch.id : null,
      batch_no: batch ? batch.batch_no : "",
      // Landed cost of the chosen batch: purchase rate + its freight share.
      cost_rate: batch ? parseFloat(batch.rate) || 0 : null,
      freight_rate: batch ? parseFloat(batch.freight_rate) || 0 : 0,
    };
  };

  const applyLine = (idx, item, batch) => {
    updateLine(idx, buildLinePatch(item, batch));
    if (
      imeiEnabled &&
      (item.imei_enabled === 1 || item.imei_enabled === true)
    ) {
      loadImeis(item.id, { force: true });
    }
  };

  const handleSelectItem = (idx, item, preferredBatchNo) => {
    const stock = Number(item.current_stock ?? 0);
    if (stockEnforced && stock <= 0) {
      toast.error(`"${item.name}" is out of stock`);
      return;
    }
    // Batch tracking: draw stock from a specific batch. A single batch is
    // applied directly; multiple batches prompt the operator to choose one,
    // unless the search already resolved a specific batch number.
    if (batchEnabled && Number(item.batch_count || 0) > 0) {
      if (Number(item.batch_count) === 1) {
        applyLine(idx, item, {
          id: item.latest_batch_id,
          batch_no: item.latest_batch_no,
          mrp: item.latest_batch_mrp,
          rate: item.latest_batch_rate,
          sales_rate: item.latest_batch_sales_rate,
          freight_rate: item.latest_batch_freight_rate,
          gst_percent: item.gst_percent,
          current_stock: item.latest_batch_stock,
        });
      } else {
        itemApi
          .getBatches(item.id)
          .then((res) => {
            const batches = res.data || [];
            const preset =
              preferredBatchNo &&
              batches.find(
                (b) =>
                  String(b.batch_no).toLowerCase() ===
                  String(preferredBatchNo).toLowerCase(),
              );
            if (preset) {
              applyLine(idx, item, preset);
            } else {
              setBatchModal({ rowIdx: idx, item, batches });
            }
          })
          .catch((err) => toast.error(err.message));
      }
      return;
    }
    applyLine(idx, item, null);
  };

  const handleBatchChosen = (batch) => {
    if (!batchModal) return;
    applyLine(batchModal.rowIdx, batchModal.item, batch);
    const rowIdx = batchModal.rowIdx;
    setBatchModal(null);
    setTimeout(() => focusCell(rowIdx, "qty"), 0);
  };

  const handleQuantityChange = (idx, value) => {
    const line = lines[idx];
    const max = maxQtyFor(line);
    const num = parseFloat(value);
    if (stockEnforced && !isNaN(num) && num > max) {
      toast.error(`Only ${max} ${line.unit || ""} available in stock`);
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

  // Whether Enter-key navigation should skip over a given field entirely.
  const isFieldAutoFocusDisabled = (field) =>
    (field === "unit" && disableAutoFocusUnit) ||
    (field === "rate" && (disableAutoFocusRate || !canEditRate)) ||
    (field === "discount" && disableAutoFocusDiscount);

  const handleCellBack = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    let prevIdx = currentIdx - 1;
    while (prevIdx >= 0 && isFieldAutoFocusDisabled(FIELD_ORDER[prevIdx]))
      prevIdx--;
    if (prevIdx >= 0) {
      focusCell(rowIdx, FIELD_ORDER[prevIdx]);
    } else if (rowIdx > 0) {
      let lastIdx = FIELD_ORDER.length - 1;
      while (lastIdx >= 0 && isFieldAutoFocusDisabled(FIELD_ORDER[lastIdx]))
        lastIdx--;
      focusCell(rowIdx - 1, FIELD_ORDER[lastIdx]);
    }
  };

  const focusCashField = () => {
    // Drop the trailing empty item rows before moving to payment entry.
    pruneEmptyLines();
    // When the Cash/UPI block is hidden, there's nothing to focus — save.
    if (!showCashUpi) {
      handleSave();
      return;
    }
    setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 0);
  };

  const handleCellEnter = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    let nextIdx = currentIdx + 1;
    while (
      nextIdx < FIELD_ORDER.length &&
      isFieldAutoFocusDisabled(FIELD_ORDER[nextIdx])
    )
      nextIdx++;
    if (nextIdx < FIELD_ORDER.length) {
      focusCell(rowIdx, FIELD_ORDER[nextIdx]);
    } else {
      // Last field (discount) — decide whether to add a new row or jump to
      // the walk-in customer fields.
      const currentLine = lines[rowIdx];
      const hasCompleteRow = lines.some((l) => l.item_id);
      // On the trailing empty row (no item selected) once at least one item
      // row is complete, Enter moves into the customer fields instead of
      // creating yet another blank row — unless auto-focus into the
      // customer fields is disabled, in which case Enter jumps straight to
      // the Cash field instead of saving the sale.
      if (
        currentLine &&
        !currentLine.item_id &&
        hasCompleteRow &&
        customerNameRef.current
      ) {
        if (disableAutoFocusCustomer) {
          focusCashField();
        } else {
          setTimeout(() => customerNameRef.current?.focus(), 0);
        }
        return;
      }
      // Last field (discount) — add new row and focus its item name
      const isLastRow = rowIdx === lines.length - 1;
      if (isLastRow) {
        const hasEmptyRow = lines.some((l) => !l.item_id);
        if (hasEmptyRow) {
          const emptyIdx = lines.findIndex((l) => !l.item_id);
          focusCell(emptyIdx, "itemName");
        } else {
          setLines((prev) => [...prev, emptyLine()]);
          setTimeout(() => focusCell(rowIdx + 1, "itemName"), 0);
        }
      } else {
        focusCell(rowIdx + 1, "itemName");
      }
    }
  };

  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const grossTotal = lines.reduce(
      (s, l) => s + (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1),
      0,
    );
    const gstTotal = lines.reduce((s, l) => {
      const r = parseFloat(l.rate) || 0;
      const q = parseFloat(l.quantity) || 1;
      const d = parseFloat(l.discount_percent) || 0;
      const g = parseFloat(l.gst_percent) || 0;
      const gross = r * q * (1 - d / 100);
      // 'taxable': GST added on top; 'inclusive': GST embedded in the gross.
      const gst =
        rateTaxMode === "taxable"
          ? (gross * g) / 100
          : gross - gross / (1 + g / 100);
      return s + Math.round(gst * 100) / 100;
    }, 0);
    const discountTotal = lines.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const d = parseFloat(l.discount_percent) || 0;
      return s + (gross * d) / 100;
    }, 0);
    const lineCount = lines.filter(
      (l) => l.item_name && l.item_name.trim(),
    ).length;
    return { total, discountTotal, gstTotal, lineCount };
  }, [lines, rateTaxMode]);

  const netTotal = Math.max(
    0,
    totals.total -
      (parseFloat(billDiscount) || 0) +
      (freightEnabled ? parseFloat(freightCharge) || 0 : 0),
  );

  // Keep the Cash/UPI split summed to the invoice total: hold the UPI amount
  // (clamped to the total) and put whatever remains into Cash. This defaults a
  // fresh bill to "full amount in cash" and rebalances as the total changes.
  useEffect(() => {
    const upi = Math.min(Math.max(parseFloat(upiAmount) || 0, 0), netTotal);
    const cash = Math.round((netTotal - upi) * 100) / 100;
    setUpiAmount(upi ? String(upi) : "");
    setCashAmount(String(cash));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netTotal]);

  // Editing one field auto-fills the other so the pair always equals netTotal.
  const handleCashChange = (val) => {
    setCashAmount(val);
    const cash = Math.min(Math.max(parseFloat(val) || 0, 0), netTotal);
    setUpiAmount(String(Math.round((netTotal - cash) * 100) / 100));
  };
  const handleUpiChange = (val) => {
    setUpiAmount(val);
    const upi = Math.min(Math.max(parseFloat(val) || 0, 0), netTotal);
    setCashAmount(String(Math.round((netTotal - upi) * 100) / 100));
  };

  const paymentBalanced =
    Math.abs(
      (parseFloat(cashAmount) || 0) + (parseFloat(upiAmount) || 0) - netTotal,
    ) <= 0.01;

  // Tendered/Return row is shown only when the global cash-tender field is on
  // AND the per-screen toggle keeps it visible.
  const tenderVisible = cashTenderEnabled && showCashTender;

  // Change to hand back = cash tendered minus the cash portion of the bill.
  const changeDue = Math.max(
    0,
    (parseFloat(tenderedAmount) || 0) - (parseFloat(cashAmount) || 0),
  );

  // Derives stock + cost info for the currently focused item row.
  const focusedItemInfo = useMemo(() => {
    if (focusedRow == null) return null;
    const line = lines[focusedRow];
    if (!line?.item_id) return null;
    const item = items.find((it) => it.id === line.item_id);
    if (!item) return null;
    const stock = Number(item.current_stock ?? line.current_stock ?? 0);
    let cost = null;
    if (line.batch_id && line.cost_rate != null) {
      // Batch line: landed cost = (purchase rate + freight share) incl GST.
      const gst = parseFloat(line.gst_percent) || 0;
      const base = parseFloat(line.cost_rate) || 0;
      const freight = parseFloat(line.freight_rate) || 0;
      cost = {
        costRate: (base + freight) * (1 + gst / 100),
        gst,
        baseRate: base,
        freight,
      };
    } else if (item.last_purchase_rate != null) {
      const gst = item.last_purchase_gst || 0;
      cost = {
        costRate: item.last_purchase_rate * (1 + gst / 100),
        gst,
        baseRate: item.last_purchase_rate,
        freight: 0,
      };
    }
    return {
      name: item.name || line.item_name,
      unit: line.unit,
      stock,
      cost,
      imeis: Array.isArray(line.imeis) ? line.imeis : [],
    };
  }, [focusedRow, lines, items]);

  // A line needs IMEI selection only when the IMEI module is enabled AND the
  // selected item has been flagged "IMEI Enable" in its master record.
  const itemImeiTracked = (line) => {
    if (!imeiEnabled || !line?.item_id) return false;
    const it = items.find((x) => x.id === line.item_id);
    return Boolean(it && (it.imei_enabled === 1 || it.imei_enabled === true));
  };

  const handleSave = async () => {
    if (!ledger) {
      toast.error("Select a customer ledger");
      return;
    }
    const validLines = lines.filter((l) => l.item_name && l.item_name.trim());
    if (validLines.length === 0) {
      toast.error("Add at least one item line");
      return;
    }

    const unresolved = validLines.find((l) => !l.item_id);
    if (unresolved) {
      toast.error(
        `"${unresolved.item_name.trim()}" is not a saved item. Select it from the list or create it first.`,
      );
      return;
    }

    if (isCashLedger && customerMobile && customerMobile.length !== 10) {
      toast.error("Customer mobile must be exactly 10 digits");
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
    if (stockEnforced) {
      const perItem = new Map();
      for (const l of validLines) {
        if (!l.item_id) continue;
        const entry = perItem.get(l.item_id) || {
          name: l.item_name,
          qty: 0,
          available:
            (Number(l.current_stock) || 0) + (Number(l.original_quantity) || 0),
          unit: l.unit,
        };
        entry.qty += parseFloat(l.quantity) || 0;
        perItem.set(l.item_id, entry);
      }
      for (const [, info] of perItem) {
        if (info.qty > info.available) {
          toast.error(
            `Quantity for "${info.name}" exceeds available stock (${info.available} ${info.unit || ""})`,
          );
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
        if (sel.length !== qty) {
          firstBad = i;
          break;
        }
      }
      if (firstBad >= 0) {
        const l = validLines[firstBad];
        const sel = Array.isArray(l.imeis) ? l.imeis.filter(Boolean) : [];
        const qty = Math.floor(parseFloat(l.quantity) || 0);
        setShowImeiErrors(true);
        toast.error(
          `Row ${firstBad + 1}: select ${qty} IMEI${qty === 1 ? "" : "s"} for "${l.item_name}" (selected ${sel.length})`,
        );
        return;
      }
      setShowImeiErrors(false);
    }

    if (!paymentBalanced) {
      toast.error("Cash and UPI amounts must add up to the total");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ledger_id: ledger.id,
        date,
        time,
        notes,
        customer_name: isCashLedger ? customerName.trim() : "",
        customer_mobile: isCashLedger ? customerMobile.trim() : "",
        customer_place: isCashLedger ? customerPlace.trim() : "",
        customer_id: isCashLedger ? customerId || null : null,
        bill_discount: parseFloat(billDiscount) || 0,
        freight_charge: freightEnabled ? parseFloat(freightCharge) || 0 : 0,
        cash_amount: parseFloat(cashAmount) || 0,
        upi_amount: parseFloat(upiAmount) || 0,
        tendered_amount: parseFloat(tenderedAmount) || 0,
        waiter_id: restaurantEnabled && waiterId ? parseInt(waiterId) : null,
        waiter_name:
          restaurantEnabled && waiterId
            ? waiters.find((w) => String(w.id) === String(waiterId))?.name || ""
            : "",
        service_type: restaurantEnabled ? serviceType : "",
        dining_type: restaurantEnabled ? diningType : "dining",
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
          batch_id: batchEnabled ? l.batch_id || null : null,
          batch_no: batchEnabled ? l.batch_no || "" : "",
          imeis: itemImeiTracked(l)
            ? Array.isArray(l.imeis)
              ? l.imeis.map((s) => String(s || "").trim()).filter(Boolean)
              : []
            : [],
        })),
      };
      const res = isEdit
        ? await saleApi.update(saleIdParam, payload)
        : await saleApi.create(payload);
      toast.success(
        isEdit ? "Sale updated" : `Sale ${res.data.sale_number} saved`,
      );
      if (res.data) {
        openSalePreview(res.data, ledger?.name, false);
      }
      if (!isEdit) {
        localStorage.removeItem(draftKeyFor(activeCounter));
        // Restore the default CASH ledger so the walk-in customer fields stay
        // mounted; otherwise Enter navigation on the empty row has no customer
        // fields to jump to and loops back to the item name cell.
        draftLedgerRestored.current = false;
        setLedger(null);
        ledgerApi
          .getCash()
          .then((r) => {
            if (r.data) setLedger(r.data);
          })
          .catch(() => {});
        setDate(todayISO());
        setTime(nowHHMM());
        setNotes("");
        setCustomerName("");
        setCustomerMobile("");
        setCustomerPlace("");
        setCustomerId(null);
        setBillDiscount("0");
        setFreightCharge("0");
        setCashAmount("");
        setUpiAmount("");
        setTenderedAmount("");
        setWaiterId("");
        setServiceType("non_ac");
        setDiningType("dining");
        setLines([emptyLine()]);
        saleApi
          .getNextNumber()
          .then((r) => setSaleNumber(r.data?.sale_number || ""))
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
      config: receiptConfig,
    });
    navigateAfterPreviewRef.current = navigateAfter;
    setPreviewModal({ open: true, html, sale });
  };

  const closePreview = () => {
    const shouldNavigate = navigateAfterPreviewRef.current;
    navigateAfterPreviewRef.current = false;
    setPreviewModal({ open: false, html: "", sale: null });
    if (shouldNavigate) navigate("/item-sales");
  };

  // When the receipt preview opens, focus the Print button so a subsequent
  // Enter press triggers printing directly.
  useEffect(() => {
    if (previewModal.open) {
      const t = setTimeout(() => printButtonRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [previewModal.open]);

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
    const currentName = lines[rowIdx]?.item_name || "";
    const qs = new URLSearchParams({
      returnTo: isEdit ? `/item-sales/${saleIdParam}/edit` : "/item-sales/new",
      ...(currentName ? { name: currentName } : {}),
    }).toString();
    navigate(`/items/new?${qs}`);
  };

  // Clear the cached draft and reset the form to a fresh, empty entry.
  const handleResetDraft = () => {
    localStorage.removeItem(draftKeyFor(activeCounter));
    draftLedgerRestored.current = false;
    setLedger(null);
    setDate(todayISO());
    setTime(nowHHMM());
    setNotes("");
    setCustomerName("");
    setCustomerMobile("");
    setCustomerPlace("");
    setCustomerId(null);
    setBillDiscount("0");
    setFreightCharge("0");
    setCashAmount("");
    setUpiAmount("");
    setTenderedAmount("");
    setWaiterId("");
    setServiceType("non_ac");
    setDiningType("dining");
    setLines([emptyLine()]);
    setShowImeiErrors(false);
    ledgerApi
      .getCash()
      .then((r) => {
        if (r.data) setLedger(r.data);
      })
      .catch(() => {});
    toast.success("Entry reset");
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-shrink-0 flex-nowrap overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title whitespace-nowrap">
              {isEdit ? "Edit Sale" : "Item Sales Entry"}
            </h1>
            <p className="text-sm text-slate-500">Sale {saleNumber || "—"}</p>
          </div>
          {!isEdit && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="ml-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-600 shadow-sm hover:border-amber-300 hover:bg-amber-100 hover:text-amber-700 hover:shadow transition-all"
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
          {multiCounterEnabled && !isEdit && (
            <div
              className="ml-2 flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm"
              title="Switch sale counter (F2)"
            >
              {[1, 2, 3, 4].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => switchCounter(c)}
                  className={`flex items-center rounded-md px-3 py-1 text-sm font-semibold transition-all duration-300 ease-out ${
                    activeCounter === c
                      ? "bg-trust-blue text-white shadow"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  C
                  <span
                    className={`inline-block overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                      activeCounter === c
                        ? "max-w-[4rem] opacity-100"
                        : "max-w-0 opacity-0"
                    }`}
                  >
                    {"ounter\u00A0"}
                  </span>
                  {c}
                </button>
              ))}
              <kbd
                className="ml-1 mr-1 hidden rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline-block"
                title="Press F2 to switch"
              >
                F2
              </kbd>
            </div>
          )}
        </div>

        {/* Top-right: customer ledger + date + time */}
        <div className="flex flex-nowrap items-end gap-2 shrink-0">
          <div className="w-44">
            <label className="text-xs text-slate-500">Customer Ledger *</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Create new ledger"
                onClick={() =>
                  navigate(
                    "/ledger-creation?returnTo=" +
                      encodeURIComponent(location.pathname + location.search),
                  )
                }
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
          {restaurantEnabled && (
            <div className="flex items-end gap-2">
              <div className="w-32">
                <label className="text-xs text-slate-500">Service Type</label>
                <div className="flex h-9 rounded-lg border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      handleServiceTypeChange(serviceType === "ac" ? "" : "ac")
                    }
                    className={`flex-1 text-xs font-semibold transition-colors ${serviceType === "ac" ? "bg-trust-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    A/C
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleServiceTypeChange(
                        serviceType === "non_ac" ? "" : "non_ac",
                      )
                    }
                    className={`flex-1 text-xs font-semibold border-l border-slate-300 transition-colors ${serviceType === "non_ac" ? "bg-trust-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    Non-A/C
                  </button>
                </div>
              </div>
              <div className="w-36">
                <label className="text-xs text-slate-500">Dining</label>
                <div className="flex h-9 rounded-lg border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDiningType("dining")}
                    className={`flex-1 text-xs font-semibold transition-colors ${diningType === "dining" ? "bg-trust-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    Dining
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiningType("take_away")}
                    className={`flex-1 text-xs font-semibold border-l border-slate-300 transition-colors ${diningType === "take_away" ? "bg-trust-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    Take-away
                  </button>
                </div>
              </div>
              <div className="w-32">
                <label className="text-xs text-slate-500">Waiter</label>
                <select
                  value={waiterId}
                  onChange={(e) => setWaiterId(e.target.value)}
                  className="input-field"
                >
                  <option value="">— None —</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="w-36">
            <label className="text-xs text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="w-24">
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
                <th className="px-3 py-2 text-left font-semibold text-white w-12">
                  S.no
                </th>
                <th className="px-3 py-2 text-left font-semibold text-white min-w-[18rem]">
                  Item Name
                </th>
                {batchEnabled && (
                  <th className="px-3 py-2 text-left font-semibold text-white w-32 whitespace-nowrap">
                    Batch No.
                  </th>
                )}
                <th className="px-3 py-2 text-left font-semibold text-white w-28">
                  Unit
                </th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">
                  MRP
                </th>
                <th className="px-3 py-2 text-right font-semibold text-white w-28">
                  {rateTaxMode === "taxable"
                    ? "Taxable rate"
                    : "Rate(Inc. tax)"}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">
                  Disc %
                </th>
                <th className="px-3 py-2 text-right font-semibold text-white w-24">
                  GST %
                </th>
                <th className="px-3 py-2 text-right font-semibold text-white w-28">
                  Amount
                </th>
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
                  <td className="px-3 py-2">
                    <ItemNameCell
                      value={line.item_name}
                      items={items}
                      onChange={(v) =>
                        updateLine(idx, {
                          item_name: v,
                          item_id: null,
                          imeis: [],
                        })
                      }
                      onSelect={(it, batchNo) =>
                        handleSelectItem(idx, it, batchNo)
                      }
                      registerRef={(ref) => setCellRef(idx, "itemName", ref)}
                      onKeyEnter={() => handleCellEnter(idx, "itemName")}
                      onKeyBack={() => handleCellBack(idx, "itemName")}
                      onAddNew={() => handleAddNewItem(idx)}
                      hideStock={restaurantEnabled}
                    />
                  </td>
                  {batchEnabled && (
                    <td className="px-3 py-2">
                      {line.batch_no ? (
                        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                          {line.batch_no}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {line.unit}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatCurrency(line.mrp || 0)}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      ref={(el) => setCellRef(idx, "rate", { current: el })}
                      type="number"
                      step="0.01"
                      value={line.rate}
                      onChange={(e) =>
                        updateLine(idx, { rate: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCellEnter(idx, "rate");
                        } else if (e.key === "ArrowLeft" && !e.target.value) {
                          e.preventDefault();
                          handleCellBack(idx, "rate");
                        }
                      }}
                      disabled={!canEditRate}
                      title={
                        !canEditRate
                          ? "You are not permitted to edit the item rate"
                          : undefined
                      }
                      className={`w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue ${!canEditRate ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}`}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ImeiSaleQtyCell
                      enabled={itemImeiTracked(line)}
                      itemId={line.item_id}
                      quantity={line.quantity}
                      selected={line.imeis}
                      pool={
                        line.item_id ? availableImeis[line.item_id] || [] : []
                      }
                      usedElsewhere={
                        new Set(
                          lines
                            .filter(
                              (other, i) =>
                                i !== idx && other.item_id === line.item_id,
                            )
                            .flatMap((other) =>
                              Array.isArray(other.imeis) ? other.imeis : [],
                            ),
                        )
                      }
                      onQuantityChange={(v) => handleQuantityChange(idx, v)}
                      onSelectedChange={(arr) =>
                        updateLine(idx, { imeis: arr })
                      }
                      onOpen={() => line.item_id && loadImeis(line.item_id)}
                      registerRef={(ref) => setCellRef(idx, "qty", ref)}
                      onKeyEnter={() => handleCellEnter(idx, "qty")}
                      onKeyBack={() => handleCellBack(idx, "qty")}
                      invalid={
                        (stockEnforced &&
                          Boolean(line.item_id) &&
                          parseFloat(line.quantity) > maxQtyFor(line)) ||
                        (showImeiErrors &&
                          itemImeiTracked(line) &&
                          (Array.isArray(line.imeis)
                            ? line.imeis.filter(Boolean).length
                            : 0) !== Math.floor(parseFloat(line.quantity) || 0))
                      }
                      stockTitle={
                        !restaurantEnabled &&
                        line.item_id &&
                        line.current_stock != null
                          ? `In stock: ${line.current_stock}`
                          : undefined
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      ref={(el) => setCellRef(idx, "discount", { current: el })}
                      type="number"
                      step="0.01"
                      value={line.discount_percent}
                      onChange={(e) =>
                        updateLine(idx, { discount_percent: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCellEnter(idx, "discount");
                        } else if (e.key === "ArrowLeft" && !e.target.value) {
                          e.preventDefault();
                          handleCellBack(idx, "discount");
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-center text-slate-600">
                    {line.gst_percent ? `${line.gst_percent}%` : "—"}
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
          <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm">
            <span className="text-slate-500">Items</span>
            <span className="font-medium text-slate-700">
              {totals.lineCount}
            </span>
          </div>
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
                  <label className="text-xs font-medium text-slate-500">
                    Customer Name
                  </label>
                  <CustomerAutocomplete
                    ref={customerNameRef}
                    value={customerName}
                    onChange={(v) => {
                      // Manual typing = potential new walk-in; drop any prior
                      // selection so the backend re-resolves by mobile.
                      setCustomerName(v);
                      setCustomerId(null);
                    }}
                    onSelect={(c) => {
                      setCustomerName(c.name || "");
                      setCustomerMobile(c.mobile || "");
                      setCustomerPlace(c.place || "");
                      setCustomerId(c.id);
                      setTimeout(() => customerMobileRef.current?.focus(), 0);
                    }}
                    onKeyDownExtra={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        customerMobileRef.current?.focus();
                      }
                    }}
                    placeholder="Search or add walk-in customer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">
                    Customer Mobile
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    ref={customerMobileRef}
                    value={customerMobile}
                    onChange={(e) => {
                      setCustomerMobile(
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      );
                      setCustomerId(null);
                    }}
                    onFocus={pruneEmptyLines}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        customerPlaceRef.current?.focus();
                      }
                    }}
                    className={`input-field ${customerMobile && customerMobile.length !== 10 ? "border-red-400" : ""}`}
                    placeholder="Mobile number"
                  />
                  {customerMobile && customerMobile.length !== 10 && (
                    <p className="text-xs text-red-500">
                      Mobile number must be exactly 10 digits.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">
                    Customer Place
                  </label>
                  <input
                    type="text"
                    ref={customerPlaceRef}
                    value={customerPlace}
                    onChange={(e) => setCustomerPlace(e.target.value)}
                    onFocus={pruneEmptyLines}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    className="input-field"
                    placeholder="Place / location"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-between gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-100">
            <div className="space-y-1">
              {showItemDiscount && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total Item Discount</span>
                  <span className="font-medium text-amber-700">
                    {formatCurrency(totals.discountTotal)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Bill Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value)}
                  disabled={!canEditBillDiscount}
                  title={
                    !canEditBillDiscount
                      ? "You are not permitted to edit the bill discount"
                      : undefined
                  }
                  className={`w-28 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-sm text-amber-700 font-medium focus:border-trust-blue focus:outline-none focus:ring-1 focus:ring-trust-blue ${!canEditBillDiscount ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}`}
                />
              </div>
              {freightEnabled && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Freight Charge</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freightCharge}
                    onChange={(e) => setFreightCharge(e.target.value)}
                    className="w-28 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-sm text-slate-700 font-medium focus:border-trust-blue focus:outline-none focus:ring-1 focus:ring-trust-blue"
                  />
                </div>
              )}
              {ledger?.igst_status === "YES" ? (
                showIgst && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">IGST</span>
                    <span className="font-medium text-blue-700">
                      {formatCurrency(totals.gstTotal)}
                    </span>
                  </div>
                )
              ) : (
                <>
                  {showCgst && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">CGST</span>
                      <span className="font-medium text-blue-700">
                        {formatCurrency(totals.gstTotal / 2)}
                      </span>
                    </div>
                  )}
                  {showSgst && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">SGST</span>
                      <span className="font-medium text-blue-700">
                        {formatCurrency(totals.gstTotal / 2)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {showGst && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total GST</span>
                  <span className="font-medium text-blue-700">
                    {formatCurrency(totals.gstTotal)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold text-slate-700">Total Amount</span>
              <span className="font-bold text-lg text-debit-red">
                {formatCurrency(netTotal)}
              </span>
            </div>
            {showCashUpi && (
              <div className="space-y-1 border-t border-slate-200 pt-2 mt-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">Cash</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashAmount}
                      onChange={(e) => handleCashChange(e.target.value)}
                      ref={cashInputRef}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          upiInputRef.current?.focus();
                          upiInputRef.current?.select();
                        }
                      }}
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-sm font-medium text-slate-700 focus:border-trust-blue focus:outline-none focus:ring-1 focus:ring-trust-blue"
                    />
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">UPI</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={upiAmount}
                      onChange={(e) => handleUpiChange(e.target.value)}
                      ref={upiInputRef}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (tenderVisible) {
                            tenderedInputRef.current?.focus();
                            tenderedInputRef.current?.select();
                          } else {
                            e.currentTarget.blur();
                            handleSave();
                          }
                        }
                      }}
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-sm font-medium text-slate-700 focus:border-trust-blue focus:outline-none focus:ring-1 focus:ring-trust-blue"
                    />
                  </div>
                </div>
                {tenderVisible && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">Tendered</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(e.target.value)}
                        ref={tenderedInputRef}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                            handleSave();
                          }
                        }}
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-sm font-medium text-slate-700 focus:border-trust-blue focus:outline-none focus:ring-1 focus:ring-trust-blue"
                      />
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">Return</span>
                      <span
                        className={`font-semibold ${changeDue > 0 ? "text-credit-green" : "text-slate-400"}`}
                      >
                        {formatCurrency(changeDue)}
                      </span>
                    </div>
                  </div>
                )}
                {!paymentBalanced && (
                  <div className="text-right text-xs font-medium text-debit-red">
                    Cash + UPI must equal {formatCurrency(netTotal)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-100">
          {/* Footer info — shows stock + cost rate of the focused item row */}
          <div className="flex items-center gap-4 text-xs min-h-[1.5rem]">
            {ledger && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">{ledger.name} Balance:</span>
                <span
                  className={`font-bold ${(parseFloat(ledger.current_balance) || 0) < 0 ? "text-debit-red" : "text-credit-green"}`}
                >
                  {formatCurrency(
                    Math.abs(parseFloat(ledger.current_balance) || 0),
                  )}
                  {(parseFloat(ledger.current_balance) || 0) < 0
                    ? " Dr"
                    : " Cr"}
                </span>
              </span>
            )}
            {focusedItemInfo && (
              <>
                <span
                  className="font-medium text-slate-600 truncate max-w-[160px]"
                  title={focusedItemInfo.name}
                >
                  {focusedItemInfo.name}
                </span>
                {!restaurantEnabled && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Stock:</span>
                    <span
                      className={`font-bold ${focusedItemInfo.stock <= 0 ? "text-debit-red" : "text-credit-green"}`}
                    >
                      {focusedItemInfo.stock}
                    </span>
                    {focusedItemInfo.unit && (
                      <span className="text-slate-400">
                        {focusedItemInfo.unit}
                      </span>
                    )}
                  </span>
                )}
                {focusedItemInfo.cost && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Cost Rate:</span>
                    <span className="font-bold text-slate-700">
                      {formatCurrency(focusedItemInfo.cost.costRate)}
                    </span>
                    {(focusedItemInfo.cost.gst > 0 ||
                      focusedItemInfo.cost.freight > 0) && (
                      <span className="text-slate-400">
                        ({formatCurrency(focusedItemInfo.cost.baseRate)}
                        {focusedItemInfo.cost.freight > 0 && (
                          <>
                            {" + "}
                            {formatCurrency(focusedItemInfo.cost.freight)} freight
                          </>
                        )}
                        {focusedItemInfo.cost.gst > 0 && (
                          <> + {focusedItemInfo.cost.gst}% GST</>
                        )}
                        )
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
            <button
              type="button"
              onClick={() => navigate("/item-sales")}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Saving…" : isEdit ? "Update Sale" : "Save Sale"}
            </button>
          </div>
        </div>
      </div>

      {/* Batch selection dialog */}
      <Modal
        open={Boolean(batchModal)}
        onClose={() => setBatchModal(null)}
        title={
          batchModal ? `Select batch — ${batchModal.item.name}` : "Select batch"
        }
        size="lg"
      >
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            This item has multiple batches. Choose the batch to sell from.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {(batchModal?.batches || []).map((b) => {
              const outOfStock = Number(b.current_stock ?? 0) <= 0;
              const price = b.sales_rate != null ? b.sales_rate : b.mrp;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={stockEnforced && outOfStock}
                  onClick={() => handleBatchChosen(b)}
                  className={`flex w-full items-center gap-4 px-3 py-2.5 text-left text-sm hover:bg-trust-blue/10 transition-colors ${
                    stockEnforced && outOfStock
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                >
                  <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                    {b.batch_no}
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(price)}
                  </span>
                  <span className="text-xs text-slate-500">
                    MRP {formatCurrency(b.mrp)}
                  </span>
                  <span
                    className={`ml-auto text-xs font-medium ${outOfStock ? "text-debit-red" : "text-slate-600"}`}
                  >
                    Stock: {Number(b.current_stock ?? 0)}
                  </span>
                </button>
              );
            })}
            {batchModal && batchModal.batches.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No batches found for this item.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Item Sales Settings dialog */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Item Sales Settings"
        size="xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-100 gap-x-8 gap-y-5 py-1">
          {/* Left column: entry behaviour */}
          <div className="space-y-5 md:pr-2">
            {!restaurantEnabled && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Stock Lock
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, sales are blocked if quantity exceeds
                    available stock. Disable to allow sales even when stock is
                    zero or negative.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={stockLock}
                  onClick={() => toggleStockLock(!stockLock)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-trust-blue focus:ring-offset-2 ${
                    stockLock ? "bg-trust-blue" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      stockLock ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">
                Rate Tax Treatment
              </p>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Choose whether the entered rate already includes GST, or is the
                pre-tax (taxable) value with GST added on top.
              </p>
              <div className="flex gap-2">
                {[
                  { val: "inclusive", label: "Inclusive of tax" },
                  { val: "taxable", label: "Taxable rate" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setRateTaxModePersist(opt.val)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      rateTaxMode === opt.val
                        ? "bg-trust-blue text-white border-trust-blue"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">
                Totals Summary Fields
              </p>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Show or hide individual lines in the totals summary. Hidden
                lines free up space in the summary panel.
              </p>
              <div className="space-y-2">
                {[
                  {
                    key: "cgst",
                    label: "CGST",
                    value: showCgst,
                    toggle: toggleShowCgst,
                  },
                  {
                    key: "sgst",
                    label: "SGST",
                    value: showSgst,
                    toggle: toggleShowSgst,
                  },
                  {
                    key: "igst",
                    label: "IGST",
                    value: showIgst,
                    toggle: toggleShowIgst,
                  },
                  {
                    key: "gst",
                    label: "Total GST",
                    value: showGst,
                    toggle: toggleShowGst,
                  },
                  {
                    key: "itemDiscount",
                    label: "Total Item Discount",
                    value: showItemDiscount,
                    toggle: toggleShowItemDiscount,
                  },
                ].map((opt) => (
                  <div
                    key={opt.key}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-slate-600">{opt.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={opt.value}
                      onClick={() => opt.toggle(!opt.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-trust-blue focus:ring-offset-2 ${
                        opt.value ? "bg-trust-blue" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          opt.value ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">
                Payment Fields
              </p>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Show or hide the payment entry fields on the totals panel.
              </p>
              <div className="space-y-2">
                {[
                  {
                    key: "cashUpi",
                    label: "CASH / UPI Fields",
                    value: showCashUpi,
                    toggle: toggleShowCashUpi,
                  },
                  {
                    key: "cashTender",
                    label: "Cash Tender (Tendered / Return)",
                    value: showCashTender,
                    toggle: toggleShowCashTender,
                  },
                ].map((opt) => (
                  <div
                    key={opt.key}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-slate-600">{opt.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={opt.value}
                      onClick={() => opt.toggle(!opt.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-trust-blue focus:ring-offset-2 ${
                        opt.value ? "bg-trust-blue" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          opt.value ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Enter-key auto-focus behaviour */}
          <div className="space-y-5 md:pl-6">
            <p className="text-sm font-medium text-slate-700 md:-mt-0">
              Enter-key Auto-focus
            </p>
            {[
              {
                key: "unit",
                label: "Disable Auto-focus Unit field",
                hint: "When enabled, Enter on the Item Name field skips the Unit field and focuses Rate directly. The Unit field stays usable by clicking or tabbing into it manually.",
                value: disableAutoFocusUnit,
                toggle: toggleDisableAutoFocusUnit,
              },
              {
                key: "rate",
                label: "Disable Auto-focus Rate field",
                hint: "When enabled, Enter navigation skips the Rate field entirely. The Rate field stays usable by clicking or tabbing into it manually.",
                value: disableAutoFocusRate,
                toggle: toggleDisableAutoFocusRate,
              },
              {
                key: "discount",
                label: "Disable Auto-focus Discount field",
                hint: "When enabled, Enter on the Quantity field skips the Discount field entirely. The Discount field stays usable by clicking or tabbing into it manually.",
                value: disableAutoFocusDiscount,
                toggle: toggleDisableAutoFocusDiscount,
              },
              {
                key: "customer",
                label: "Disable Auto-focus Customer fields",
                hint: "When enabled, Enter after the last item row saves the sale directly instead of jumping to the Customer Name field.",
                value: disableAutoFocusCustomer,
                toggle: toggleDisableAutoFocusCustomer,
              },
            ].map((opt, i) => (
              <div
                key={opt.key}
                className={`flex items-center justify-between gap-4 ${i > 0 ? "border-t border-slate-100 pt-4" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={opt.value}
                  onClick={() => opt.toggle(!opt.value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-trust-blue focus:ring-offset-2 ${
                    opt.value ? "bg-trust-blue" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      opt.value ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        open={previewModal.open}
        onClose={closePreview}
        title="Sale Receipt Preview"
        size="lg"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Format:</span>
            {["thermal", "a5", "a4"].map((f) => (
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
                      config: receiptConfig,
                    });
                    setPreviewModal((prev) => ({ ...prev, html }));
                  }
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                  receiptFormat === f
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f === "thermal" ? "Thermal 80mm" : f.toUpperCase()}
              </button>
            ))}
          </div>
          <iframe
            ref={previewIframeRef}
            srcDoc={previewModal.html}
            title="Sale Receipt Preview"
            className="w-full border border-slate-200 rounded bg-white"
            style={{ minHeight: 380, maxHeight: 600, overflowX: "hidden" }}
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc)
                e.target.style.height =
                  Math.min(doc.body.scrollHeight + 8, 600) + "px";
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closePreview}
              className="btn-secondary"
            >
              Close
            </button>
            <button
              ref={printButtonRef}
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
