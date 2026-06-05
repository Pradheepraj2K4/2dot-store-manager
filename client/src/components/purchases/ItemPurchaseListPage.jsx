import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { purchaseApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

export default function ItemPurchaseListPage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deleteModal, setDeleteModal] = useState({ open: false, purchase: null });

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const res = await purchaseApi.getAll();
      setPurchases(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPurchases(); }, []);

  const toggleExpand = async (id) => {
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: null }));
      return;
    }
    try {
      const res = await purchaseApi.getById(id);
      setExpanded((p) => ({ ...p, [id]: res.data }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await purchaseApi.delete(deleteModal.purchase.id);
      toast.success('Purchase deleted');
      setDeleteModal({ open: false, purchase: null });
      fetchPurchases();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = purchases.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(p.purchase_number).includes(q) ||
      (p.ledger_name || '').toLowerCase().includes(q) ||
      (p.bill_number || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Item Purchases</h1>
          <p className="text-sm text-slate-500">
            Stock-in entries from suppliers. Ledger balances are not affected.
          </p>
        </div>
        <button onClick={() => navigate('/item-purchases/new')} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Purchase
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
              placeholder="Search by purchase #, supplier, or bill #…"
              className="input-field pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={ArrowDownTrayIcon} title="No purchases" description="Record your first purchase to get started" />
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
                      <td className="px-4 py-2.5 text-slate-600">
                        {formatDate(p.date)}{p.time ? ` · ${p.time}` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{p.item_count}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-credit-green">{formatCurrency(p.total_amount)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/item-purchases/${p.id}/edit`)}
                            className="text-slate-400 hover:text-trust-blue transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, purchase: p })}
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
                      <tr key={`${p.id}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={8} className="px-4 py-3">
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
                                    {line.item_id && <span className="ml-2 font-mono text-[10px] text-slate-400">{line.item_id}</span>}
                                  </td>
                                  <td className="px-2 py-1 text-slate-600">{line.unit}</td>
                                  <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(line.mrp)}</td>
                                  <td className="px-2 py-1 text-right text-slate-700">{formatCurrency(line.rate)}</td>
                                  <td className="px-2 py-1 text-right text-slate-600">{line.quantity}</td>
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
        onClose={() => setDeleteModal({ open: false, purchase: null })}
        title="Delete Purchase"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete purchase <strong>{deleteModal.purchase?.purchase_number}</strong>?
          The stock added by this purchase ({formatCurrency(deleteModal.purchase?.total_amount || 0)}) will be reversed from each item.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModal({ open: false, purchase: null })} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
