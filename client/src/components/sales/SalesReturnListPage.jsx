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
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { salesReturnApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

export default function SalesReturnListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deleteModal, setDeleteModal] = useState({ open: false, row: null });

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await salesReturnApi.getAll();
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  const toggleExpand = async (id) => {
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: null }));
      return;
    }
    try {
      const res = await salesReturnApi.getById(id);
      setExpanded((p) => ({ ...p, [id]: res.data }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await salesReturnApi.delete(deleteModal.row.id);
      toast.success('Sales return deleted');
      setDeleteModal({ open: false, row: null });
      fetchRows();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(r.return_number).includes(q) ||
      (r.ledger_name || '').toLowerCase().includes(q) ||
      (r.sale_number ? String(r.sale_number).includes(q) : false)
    );
  });

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Sales Returns</h1>
          <p className="text-sm text-slate-500">Returns received from customers. Stock is added back automatically.</p>
        </div>
        <button onClick={() => navigate('/sales-return')} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Sales Return
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
              placeholder="Search by return #, sale # or customer…"
              className="input-field pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={ArrowUturnLeftIcon} title="No sales returns" description="Record your first sales return to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 w-10"></th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-24">Return #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Sale #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Refund</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const detail = expanded[r.id];
                  const isOpen = Boolean(detail);
                  const rowEls = [
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleExpand(r.id)} className="text-slate-400 hover:text-slate-700 transition-colors" title="View items">
                          {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">#{r.return_number}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => navigate(`/ledger/${r.ledger_id}`)} className="font-medium text-trust-blue hover:underline">
                          {r.ledger_name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.sale_number ? `#${r.sale_number}` : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.item_count}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-credit-green">{formatCurrency(r.total_amount)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/sales-return/${r.id}/edit`)} className="text-slate-400 hover:text-trust-blue transition-colors" title="Edit">
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteModal({ open: true, row: r })} className="text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                  ];
                  if (isOpen) {
                    rowEls.push(
                      <tr key={`${r.id}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={8} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left px-2 py-1">#</th>
                                <th className="text-left px-2 py-1">Item</th>
                                <th className="text-left px-2 py-1">Unit</th>
                                <th className="text-right px-2 py-1">Rate</th>
                                <th className="text-right px-2 py-1">Qty</th>
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
                                  <td className="px-2 py-1 text-right font-medium text-slate-800">{formatCurrency(line.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {detail.reason && <p className="text-xs text-slate-500 mt-2 italic">Reason: {detail.reason}</p>}
                          {detail.notes && <p className="text-xs text-slate-500 mt-1 italic">Notes: {detail.notes}</p>}
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

      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, row: null })} title="Delete Sales Return" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Delete return <strong>#{deleteModal.row?.return_number}</strong>? The customer's balance will be increased by {formatCurrency(deleteModal.row?.total_amount || 0)} and stock will be reduced.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModal({ open: false, row: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
