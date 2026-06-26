import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { customerApi } from '../../api';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

const emptyForm = { name: '', mobile: '', place: '', address: '', notes: '' };

export default function CustomerListPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, customer: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, customer: null });

  // Refs for the add-customer fields so Enter advances to the next field
  // instead of submitting; only the last field submits the form.
  const mobileRef = useRef(null);
  const placeRef = useRef(null);

  // On Enter, move focus to the next field rather than submitting the form.
  const focusOnEnter = (ref) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.focus();
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await customerApi.getAll();
      setCustomers(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Customer name is required');
    if (form.mobile && form.mobile.length !== 10) return toast.error('Mobile must be 10 digits');
    try {
      setSaving(true);
      await customerApi.create({ ...form, name: form.name.trim() });
      toast.success('Customer added');
      setForm(emptyForm);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const c = editModal.customer;
    if (!c || !c.name.trim()) return toast.error('Customer name is required');
    if (c.mobile && c.mobile.length !== 10) return toast.error('Mobile must be 10 digits');
    try {
      await customerApi.update(c.id, c);
      toast.success('Customer updated');
      setEditModal({ open: false, customer: null });
      fetchCustomers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await customerApi.delete(deleteModal.customer.id);
      toast.success('Customer deleted');
      setDeleteModal({ open: false, customer: null });
      fetchCustomers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.mobile || '').includes(search) ||
      (c.place || '').toLowerCase().includes(q)
    );
  });

  const patchEdit = (p) => setEditModal((m) => ({ ...m, customer: { ...m.customer, ...p } }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Customers</h1>
        <p className="text-sm text-slate-500">Directory of retained customers, matched by mobile number.</p>
      </div>

      {/* Add customer */}
      <form onSubmit={handleCreate} className="card">
        <label className="label">Add Customer</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            onKeyDown={focusOnEnter(mobileRef)}
            placeholder="Name *"
            className="input-field"
            autoFocus
          />
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            ref={mobileRef}
            value={form.mobile}
            onChange={(e) => patch({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            onKeyDown={focusOnEnter(placeRef)}
            placeholder="Mobile"
            className="input-field"
          />
          <input
            type="text"
            ref={placeRef}
            value={form.place}
            onChange={(e) => patch({ place: e.target.value })}
            placeholder="Place"
            className="input-field"
          />
          <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, mobile, place…"
              className="input-field pl-9"
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" size="lg" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserGroupIcon} title="No customers" description="Add your first customer above" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-16">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-36">Mobile</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Place</th>
                  <th className="px-4 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{c.mobile || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.place || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditModal({ open: true, customer: { ...c } })} title="Edit" className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteModal({ open: true, customer: c })} title="Delete" className="p-1.5 rounded text-debit-red hover:bg-slate-100">
                          <TrashIcon className="h-4 w-4" />
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

      {/* Edit modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, customer: null })}
        title="Edit Customer"
      >
        {editModal.customer && (
          <div className="space-y-3">
            <div>
              <label className="label">Name *</label>
              <input
                type="text"
                value={editModal.customer.name}
                onChange={(e) => patchEdit({ name: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mobile</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={editModal.customer.mobile || ''}
                  onChange={(e) => patchEdit({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Place</label>
                <input
                  type="text"
                  value={editModal.customer.place || ''}
                  onChange={(e) => patchEdit({ place: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input
                type="text"
                value={editModal.customer.address || ''}
                onChange={(e) => patchEdit({ address: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setEditModal({ open: false, customer: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleUpdate} className="btn-primary">Save</button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, customer: null })}
        title="Delete Customer"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold">{deleteModal.customer?.name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDeleteModal({ open: false, customer: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
