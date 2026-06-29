import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PrinterIcon,
  ArrowRightCircleIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';
import { estimationApi, settingsApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { buildSaleReceiptHtml } from '../../utils/saleReceipt';
import { fetchLogoDataUrl } from '../../utils/interestReceipt';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function EstimationListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deleteModal, setDeleteModal] = useState({ open: false, row: null });
  const [convertModal, setConvertModal] = useState({ open: false, row: null, busy: false });

  // ── Receipt / print state ─────────────────────────────────────────────
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('thermal');
  const [previewModal, setPreviewModal] = useState({ open: false, html: '', estimation: null });
  const previewIframeRef = useRef(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await estimationApi.getAll(statusFilter ? { status: statusFilter } : {});
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line */ }, [statusFilter]);

  // Load store profile + receipt config for the printable estimate
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

  const toggleExpand = async (id) => {
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: null }));
      return;
    }
    try {
      const res = await estimationApi.getById(id);
      setExpanded((p) => ({ ...p, [id]: res.data }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await estimationApi.delete(deleteModal.row.id);
      toast.success('Estimation deleted');
      setDeleteModal({ open: false, row: null });
      fetchRows();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConvert = async () => {
    try {
      setConvertModal((p) => ({ ...p, busy: true }));
      const res = await estimationApi.convert(convertModal.row.id);
      toast.success(`Converted to sale ${res.data.sale_number}`);
      setConvertModal({ open: false, row: null, busy: false });
      navigate('/item-sales');
    } catch (err) {
      toast.error(err.message);
      setConvertModal((p) => ({ ...p, busy: false }));
    }
  };

  const buildEstimationHtml = (estimation, format) =>
    buildSaleReceiptHtml({
      sale: { ...estimation, sale_number: estimation.estimation_number },
      ledgerName: estimation.ledger_name || estimation.customer_name,
      store,
      logoDataUrl,
      format,
      docType: 'estimation',
    });

  const handlePrint = async (row) => {
    try {
      const res = await estimationApi.getById(row.id);
      const html = buildEstimationHtml(res.data, receiptFormat);
      setPreviewModal({ open: true, html, estimation: res.data });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closePreview = () => setPreviewModal({ open: false, html: '', estimation: null });

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(r.estimation_number).includes(q) ||
      (r.ledger_name || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Estimations</h1>
          <p className="text-sm text-slate-500">Quotations issued to customers. Convert to a sale when accepted.</p>
        </div>
        <button onClick={() => navigate('/estimation')} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Estimation
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by estimation # or customer…"
              className="input-field pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field sm:w-40"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="converted">Converted</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={CalculatorIcon} title="No estimations" description="Create your first estimation to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 w-10"></th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-28">Estimation #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Valid Until</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const detail = expanded[r.id];
                  const isOpen = Boolean(detail);
                  const displayCustomer = r.ledger_name || r.customer_name || '—';
                  const rowEls = [
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleExpand(r.id)}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                          title="View items"
                        >
                          {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.estimation_number}</td>
                      <td className="px-4 py-2.5">
                        {r.ledger_id ? (
                          <button
                            onClick={() => navigate(`/ledger/${r.ledger_id}`)}
                            className="font-medium text-trust-blue hover:underline"
                          >
                            {displayCustomer}
                          </button>
                        ) : (
                          <span className="text-slate-700">{displayCustomer}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.valid_until ? formatDate(r.valid_until) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.item_count}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-trust-blue">{formatCurrency(r.total_amount)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {r.status === 'open' && (
                            <button
                              onClick={() => setConvertModal({ open: true, row: r, busy: false })}
                              className="text-slate-400 hover:text-emerald-600 transition-colors"
                              title="Convert to sale"
                            >
                              <ArrowRightCircleIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handlePrint(r)}
                            className="text-slate-400 hover:text-trust-blue transition-colors"
                            title="Print estimate"
                          >
                            <PrinterIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/estimation/${r.id}/edit`)}
                            className="text-slate-400 hover:text-trust-blue transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, row: r })}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete"
                            disabled={r.status === 'converted'}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                  ];
                  if (isOpen) {
                    rowEls.push(
                      <tr key={`${r.id}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={9} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left px-2 py-1">#</th>
                                <th className="text-left px-2 py-1">Item</th>
                                <th className="text-left px-2 py-1">Unit</th>
                                <th className="text-right px-2 py-1">Rate</th>
                                <th className="text-right px-2 py-1">Qty</th>
                                <th className="text-right px-2 py-1">Disc %</th>
                                <th className="text-right px-2 py-1">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.items.map((line, idx) => (
                                <tr key={line.id} className="border-t border-slate-200">
                                  <td className="px-2 py-1 text-slate-500">{idx + 1}</td>
                                  <td className="px-2 py-1 text-slate-700">{line.item_name}</td>
                                  <td className="px-2 py-1 text-slate-600">{line.unit}</td>
                                  <td className="px-2 py-1 text-right text-slate-700">{formatCurrency(line.rate)}</td>
                                  <td className="px-2 py-1 text-right text-slate-600">{line.quantity}</td>
                                  <td className="px-2 py-1 text-right text-slate-600">{line.discount_percent || 0}%</td>
                                  <td className="px-2 py-1 text-right font-medium text-slate-800">{formatCurrency(line.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {detail.notes && <p className="text-xs text-slate-500 mt-2 italic">Notes: {detail.notes}</p>}
                        </td>
                      </tr>,
                    );
                  }
                  return rowEls;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, row: null })} title="Delete Estimation" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Delete estimation <strong>{deleteModal.row?.estimation_number}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModal({ open: false, row: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>

      <Modal open={convertModal.open} onClose={() => !convertModal.busy && setConvertModal({ open: false, row: null, busy: false })} title="Convert to Sale" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Convert estimation <strong>{convertModal.row?.estimation_number}</strong> to a sale invoice?
          This will deduct stock and update the customer's balance.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConvertModal({ open: false, row: null, busy: false })}
            className="btn-secondary"
            disabled={convertModal.busy}
          >
            Cancel
          </button>
          <button onClick={handleConvert} className="btn-primary" disabled={convertModal.busy}>
            {convertModal.busy ? 'Converting…' : 'Convert'}
          </button>
        </div>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal open={previewModal.open} onClose={closePreview} title="Estimate Preview" size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Format:</span>
            {['thermal', 'a5', 'a4'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setReceiptFormat(f);
                  if (previewModal.estimation) {
                    const html = buildEstimationHtml(previewModal.estimation, f);
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
            title="Estimate Preview"
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
