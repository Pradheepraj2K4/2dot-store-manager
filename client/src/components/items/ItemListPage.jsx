import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, CubeIcon } from '@heroicons/react/24/outline';
import { itemApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

export default function ItemListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await itemApi.getAll();
      setItems(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(it.id).includes(q) ||
      it.name.toLowerCase().includes(q) ||
      (it.item_code || '').toLowerCase().includes(q) ||
      (it.brand || '').toLowerCase().includes(q) ||
      (it.category || '').toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    try {
      await itemApi.delete(deleteModal.item.id);
      toast.success('Item deleted');
      setDeleteModal({ open: false, item: null });
      fetchItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Items</h1>
          <p className="text-sm text-slate-500">Master list of products available for sale.</p>
        </div>
        <button onClick={() => navigate('/items/new')} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Item
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
              placeholder="Search by id, code, name, brand, category…"
              className="input-field pl-9"
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={CubeIcon} title="No items" description="Add a new item to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-20">Item ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Brand</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Category</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Unit</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">MRP</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Stock</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{it.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{it.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.brand || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.category || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.unit}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(it.mrp)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={Number(it.current_stock) < 0 ? 'text-debit-red font-medium' : Number(it.current_stock) > 0 ? 'text-credit-green font-medium' : 'text-slate-500'}>
                        {Number(it.current_stock || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/items/${it.id}/edit`)}
                          className="text-slate-400 hover:text-trust-blue transition-colors"
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ open: true, item: it })}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, item: null })}
        title="Delete Item"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete <strong>{deleteModal.item?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModal({ open: false, item: null })} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
