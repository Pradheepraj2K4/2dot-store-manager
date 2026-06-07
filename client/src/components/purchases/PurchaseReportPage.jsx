import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PrinterIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  DocumentChartBarIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { purchaseApi, settingsApi } from "../../api";
import { formatCurrency, formatDate } from "../../utils/helpers";
import { buildPurchaseReceiptHtml } from "../../utils/purchaseReceipt";
import { fetchLogoDataUrl } from "../../utils/interestReceipt";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import Modal from "../ui/Modal";
import ImeiInfoButton from "../ui/ImeiInfoButton";

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEARCH_FIELDS = [
  { key: "all", label: "All Fields" },
  { key: "purchase_number", label: "Purchase #" },
  { key: "ledger_name", label: "Supplier" },
  { key: "bill_number", label: "Bill #" },
  { key: "item_name", label: "Item Name" },
  { key: "notes", label: "Notes" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Date" },
];

export default function PurchaseReportPage() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayISO());

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");

  const [expanded, setExpanded] = useState({});
  const [deleteModal, setDeleteModal] = useState({ open: false, purchase: null });

  // Print / preview state
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('thermal');
  const [previewModal, setPreviewModal] = useState({ open: false, html: '', purchase: null });

  useEffect(() => {
    (async () => {
      const [profileRes, configRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      const fmt = (configRes.data && configRes.data.format) || 'thermal';
      setReceiptFormat(['a4', 'a5', 'thermal'].includes(fmt) ? fmt : 'thermal');
      if (profile.logo_path) {
        const dl = await fetchLogoDataUrl(profile.logo_path);
        setLogoDataUrl(dl);
      }
    })();
  }, []);

  const handlePrint = async (id) => {
    try {
      const res = await purchaseApi.getById(id);
      const html = buildPurchaseReceiptHtml({
        purchase: res.data,
        store,
        logoDataUrl,
        format: receiptFormat,
      });
      setPreviewModal({ open: true, html, purchase: res.data });
    } catch (err) {
      toast.error(err.message || 'Failed to load receipt');
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const res = await purchaseApi.getAll({ fromDate, toDate });
      setPurchases(res.data);
      setExpanded({});
    } catch (err) {
      toast.error(err.message || "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = async (id) => {
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: null }));
      return;
    }
    try {
      const res = await purchaseApi.getById(id);
      setExpanded((p) => ({ ...p, [id]: res.data }));
    } catch (err) {
      toast.error(err.message || "Failed to load purchase details");
    }
  };

  const handleDelete = async () => {
    try {
      await purchaseApi.delete(deleteModal.purchase.id);
      toast.success("Purchase deleted");
      setDeleteModal({ open: false, purchase: null });
      fetchPurchases();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return purchases;
    const q = search.trim().toLowerCase();

    return purchases.filter((p) => {
      const field = searchField;
      if (field === "purchase_number" || field === "all") {
        if (String(p.purchase_number).toLowerCase().includes(q)) return true;
      }
      if (field === "ledger_name" || field === "all") {
        if ((p.ledger_name || "").toLowerCase().includes(q)) return true;
      }
      if (field === "bill_number" || field === "all") {
        if ((p.bill_number || "").toLowerCase().includes(q)) return true;
      }
      if (field === "notes" || field === "all") {
        if ((p.notes || "").toLowerCase().includes(q)) return true;
      }
      if (field === "amount" || field === "all") {
        if (String(p.total_amount).includes(q)) return true;
      }
      if (field === "date" || field === "all") {
        if ((p.date || "").includes(q)) return true;
      }
      if (field === "item_name" || field === "all") {
        const detail = expanded[p.id];
        if (detail?.items?.some((it) => (it.item_name || "").toLowerCase().includes(q))) return true;
      }
      return false;
    });
  }, [purchases, search, searchField, expanded]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0),
    [filtered],
  );
  const totalDiscount = useMemo(
    () => filtered.reduce((sum, p) => sum + (parseFloat(p.total_discount) || 0), 0),
    [filtered],
  );
  const totalGst = useMemo(
    () => filtered.reduce((sum, p) => sum + (parseFloat(p.total_gst) || 0), 0),
    [filtered],
  );

  const clearSearch = () => {
    setSearch("");
    setSearchField("all");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title">Purchase Report</h1>
          <p className="text-sm text-slate-500">
            All stock-in entries within the selected date range.
          </p>
        </div>
      </div>

      <div className="card p-3">
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-slate-500">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-slate-500">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <FunnelIcon className="h-3 w-3" />
                Search In
              </label>
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="input-field text-sm"
              >
                {SEARCH_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-slate-500">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search by ${SEARCH_FIELDS.find((f) => f.key === searchField)?.label || ""}…`}
                  className="input-field pl-9 pr-8 text-sm"
                />
                {search && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={fetchPurchases}
            disabled={loading}
            className="btn-primary flex items-center gap-2 self-end sm:self-auto"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Apply
          </button>
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="card px-4 py-2 flex items-center gap-2">
            <span className="text-slate-500">Entries:</span>
            <span className="font-semibold text-slate-800">{filtered.length}</span>
          </div>
          <div className="card px-4 py-2 flex items-center gap-2">
            <span className="text-slate-500">Total Purchase:</span>
            <span className="font-semibold text-credit-green">{formatCurrency(totalAmount)}</span>
          </div>
          {totalGst > 0 && (
            <div className="card px-4 py-2 flex items-center gap-2">
              <span className="text-slate-500">Total GST:</span>
              <span className="font-semibold text-blue-700">{formatCurrency(totalGst)}</span>
            </div>
          )}
          {totalDiscount > 0 && (
            <div className="card px-4 py-2 flex items-center gap-2">
              <span className="text-slate-500">Total Discount:</span>
              <span className="font-semibold text-amber-600">{formatCurrency(totalDiscount)}</span>
            </div>
          )}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={DocumentChartBarIcon}
            title="No purchases found"
            description={search ? "Try adjusting your search or date range." : "No purchases recorded in this date range."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 w-10"></th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-24">Purchase #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Supplier</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-32">Bill #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date / Time</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">GST</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Discount</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const detail = expanded[p.id];
                  const isOpen = Boolean(detail);
                  const rows = [
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                          title="View items"
                        >
                          {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{p.purchase_number}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => navigate(`/ledger/${p.ledger_id}`)}
                          className="font-medium text-trust-blue hover:underline"
                        >
                          {p.ledger_name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.bill_number || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs whitespace-nowrap">
                        {formatDate(p.date)}{p.time ? ` · ${p.time}` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{p.item_count}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">
                        {p.total_gst > 0 ? formatCurrency(p.total_gst) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-600">
                        {p.total_discount > 0 ? formatCurrency(p.total_discount) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-credit-green">
                        {formatCurrency(p.total_amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/item-purchases/${p.id}/edit`)}
                            className="text-slate-400 hover:text-trust-blue transition-colors"
                            title="Edit purchase"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(p.id)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Print voucher"
                          >
                            <PrinterIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, purchase: p })}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete purchase"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                  ];

                  if (isOpen) {
                    rows.push(
                      <tr key={`${p.id}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={10} className="px-6 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left px-2 py-1">#</th>
                                <th className="text-left px-2 py-1">Item</th>
                                <th className="text-left px-2 py-1">Unit</th>
                                <th className="text-right px-2 py-1">MRP</th>
                                <th className="text-right px-2 py-1">Cost Rate</th>
                                <th className="text-right px-2 py-1">Qty</th>
                                <th className="text-right px-2 py-1">Disc %</th>
                                <th className="text-right px-2 py-1">GST %</th>
                                <th className="text-right px-2 py-1">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.items.map((line, idx) => (
                                <tr key={line.id} className="border-t border-slate-200">
                                  <td className="px-2 py-1 text-slate-500">{idx + 1}</td>
                                  <td className="px-2 py-1 text-slate-700">
                                    {line.item_name}
                                    {line.item_id && (
                                      <span className="ml-2 font-mono text-[10px] text-slate-400">{line.item_id}</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-slate-600">{line.unit}</td>
                                  <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(line.mrp)}</td>
                                  <td className="px-2 py-1 text-right text-slate-700">{formatCurrency(line.rate)}</td>
                                  <td className="px-2 py-1 text-right text-slate-600">
                                    <span className="inline-flex items-center justify-end gap-1">
                                      {Array.isArray(line.imeis) && line.imeis.length > 0 && (
                                        <ImeiInfoButton
                                          title="Purchased IMEIs"
                                          groups={[{ items: line.imeis, tone: 'blue' }]}
                                        />
                                      )}
                                      {line.quantity}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-right text-slate-600">{line.discount_percent || 0}%</td>
                                  <td className="px-2 py-1 text-right text-slate-600">{line.gst_percent || 0}%</td>
                                  <td className="px-2 py-1 text-right font-medium text-slate-800">{formatCurrency(line.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {detail.notes && (
                            <p className="text-xs text-slate-500 mt-2 italic">Notes: {detail.notes}</p>
                          )}
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={5} className="px-4 py-2.5 text-sm font-semibold text-slate-700">
                    Total ({filtered.length} purchase{filtered.length !== 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-500">
                    {filtered.reduce((s, r) => s + (r.item_count || 0), 0)} items
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold text-blue-700">
                    {totalGst > 0 ? formatCurrency(totalGst) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold text-amber-600">
                    {totalDiscount > 0 ? formatCurrency(totalDiscount) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-credit-green">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, purchase: null })}
        title="Delete Purchase"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete purchase <strong>{deleteModal.purchase?.purchase_number}</strong>?
          The stock added by this purchase will be reversed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal({ open: false, purchase: null })}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        open={previewModal.open}
        onClose={() => setPreviewModal({ open: false, html: '', purchase: null })}
        title={`Purchase Voucher${previewModal.purchase ? ' ' + previewModal.purchase.purchase_number : ''}`}
        size="lg"
      >
        <PurchaseReceiptPreview
          html={previewModal.html}
          format={receiptFormat}
          onFormatChange={(f) => {
            setReceiptFormat(f);
            if (previewModal.purchase) {
              const html = buildPurchaseReceiptHtml({
                purchase: previewModal.purchase,
                store,
                logoDataUrl,
                format: f,
              });
              setPreviewModal((prev) => ({ ...prev, html }));
            }
          }}
          onClose={() => setPreviewModal({ open: false, html: '', purchase: null })}
        />
      </Modal>
    </div>
  );
}

function PurchaseReceiptPreview({ html, format, onFormatChange, onClose }) {
  const iframeRef = useRef(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Format:</span>
        {['thermal', 'a5', 'a4'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFormatChange(f)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
              format === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'thermal' ? 'Thermal 80mm' : f.toUpperCase()}
          </button>
        ))}
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Purchase Voucher Preview"
        className="w-full border border-slate-200 rounded bg-white"
        style={{ minHeight: 380, maxHeight: 600, overflowX: 'hidden' }}
        onLoad={(e) => {
          const doc = e.target.contentDocument;
          if (doc) e.target.style.height = Math.min(doc.body.scrollHeight + 8, 600) + 'px';
        }}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        <button
          type="button"
          onClick={() => iframeRef.current?.contentWindow?.print()}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <PrinterIcon className="h-4 w-4" />
          Print
        </button>
      </div>
    </div>
  );
}
