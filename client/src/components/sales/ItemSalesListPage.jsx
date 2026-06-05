import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PrinterIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { saleApi, settingsApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { buildSaleReceiptHtml } from '../../utils/saleReceipt';
import { fetchLogoDataUrl } from '../../utils/interestReceipt';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

export default function ItemSalesListPage() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deleteModal, setDeleteModal] = useState({ open: false, sale: null });

  // ── Print/preview state ──────────────────────────────────────────────
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('thermal');
  const [previewModal, setPreviewModal] = useState({ open: false, html: '', sale: null });

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
      const res = await saleApi.getById(id);
      const html = buildSaleReceiptHtml({
        sale: res.data,
        ledgerName: res.data.ledger_name,
        store,
        logoDataUrl,
        format: receiptFormat,
      });
      setPreviewModal({ open: true, html, sale: res.data });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await saleApi.getAll();
      setSales(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSales(); }, []);

  const toggleExpand = async (id) => {
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: null }));
      return;
    }
    try {
      const res = await saleApi.getById(id);
      setExpanded((p) => ({ ...p, [id]: res.data }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await saleApi.delete(deleteModal.sale.id);
      toast.success('Sale deleted');
      setDeleteModal({ open: false, sale: null });
      fetchSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(s.sale_number).includes(q) ||
      (s.ledger_name || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Item Sales</h1>
          <p className="text-sm text-slate-500">All sales invoices issued to customers.</p>
        </div>
        <button onClick={() => navigate('/item-sales/new')} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Sale
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by sale # or customer name…"
              className="input-field pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={ShoppingBagIcon} title="No sales" description="Record your first sale to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 w-10"></th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-24">Sale #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date / Time</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const detail = expanded[s.id];
                  const isOpen = Boolean(detail);
                  const rows = [
                    <tr key={s.id} className="border-b border-slate-100">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => toggleExpand(s.id)}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title="View items"
                          >
                            {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{s.sale_number}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => navigate(`/ledger/${s.ledger_id}`)}
                            className="font-medium text-trust-blue hover:underline"
                          >
                            {s.ledger_name}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {formatDate(s.date)}{s.time ? ` · ${s.time}` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{s.item_count}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-debit-red">{formatCurrency(s.total_amount)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePrint(s.id)}
                              className="text-slate-400 hover:text-emerald-600 transition-colors"
                              title="Print receipt"
                            >
                              <PrinterIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/item-sales/${s.id}/edit`)}
                              className="text-slate-400 hover:text-trust-blue transition-colors"
                              title="Edit"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ open: true, sale: s })}
                              className="text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>,
                  ];
                  if (isOpen) {
                    rows.push(
                      <tr key={`${s.id}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                          <td colSpan={7} className="px-4 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="text-left px-2 py-1">#</th>
                                  <th className="text-left px-2 py-1">Item</th>
                                  <th className="text-left px-2 py-1">Unit</th>
                                  <th className="text-right px-2 py-1">MRP</th>
                                  <th className="text-right px-2 py-1">Rate</th>
                                  <th className="text-right px-2 py-1">Disc %</th>
                                  <th className="text-right px-2 py-1">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.items.map((line, idx) => (
                                  <tr key={line.id} className="border-t border-slate-200">
                                    <td className="px-2 py-1 text-slate-500">{idx + 1}</td>
                                    <td className="px-2 py-1 text-slate-700">
                                      {line.item_name}
                                      {line.item_id && <span className="ml-2 font-mono text-[10px] text-slate-400">{line.item_id}</span>}
                                    </td>
                                    <td className="px-2 py-1 text-slate-600">{line.unit}</td>
                                    <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(line.mrp)}</td>
                                    <td className="px-2 py-1 text-right text-slate-700">{formatCurrency(line.rate)}</td>
                                    <td className="px-2 py-1 text-right text-slate-600">{line.discount_percent || 0}%</td>
                                    <td className="px-2 py-1 text-right font-medium text-slate-800">{formatCurrency(line.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {detail.notes && (
                              <p className="text-xs text-slate-500 mt-2 italic">Notes: {detail.notes}</p>
                            )}
                          </td>
                        </tr>
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, sale: null })}
        title="Delete Sale"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete sale <strong>{deleteModal.sale?.sale_number}</strong>? The customer's
          balance will be reduced by {formatCurrency(deleteModal.sale?.total_amount || 0)}.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModal({ open: false, sale: null })} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        open={previewModal.open}
        onClose={() => setPreviewModal({ open: false, html: '', sale: null })}
        title={`Sale Receipt${previewModal.sale ? ' ' + previewModal.sale.sale_number : ''}`}
        size="lg"
      >
        <SaleReceiptPreview
          html={previewModal.html}
          format={receiptFormat}
          onFormatChange={(f) => {
            setReceiptFormat(f);
            if (previewModal.sale) {
              const html = buildSaleReceiptHtml({
                sale: previewModal.sale,
                ledgerName: previewModal.sale.ledger_name,
                store,
                logoDataUrl,
                format: f,
              });
              setPreviewModal((prev) => ({ ...prev, html }));
            }
          }}
          onClose={() => setPreviewModal({ open: false, html: '', sale: null })}
        />
      </Modal>
    </div>
  );
}

function SaleReceiptPreview({ html, format, onFormatChange, onClose }) {
  const iframeRef = useState(() => ({ current: null }))[0];
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
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'thermal' ? 'Thermal 80mm' : f.toUpperCase()}
          </button>
        ))}
      </div>
      <iframe
        ref={(el) => { iframeRef.current = el; }}
        srcDoc={html}
        title="Sale Receipt Preview"
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
