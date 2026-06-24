import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { staffApi } from '../../api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

export default function StaffListPage() {
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // { id, name }
  const [deleteModal, setDeleteModal] = useState({ open: false, staff: null });

  const fetchStaffs = async () => {
    try {
      setLoading(true);
      const res = await staffApi.getAll();
      setStaffs(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaffs(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Staff name is required');
    try {
      setSaving(true);
      await staffApi.create({ name: name.trim() });
      toast.success('Staff added');
      setName('');
      fetchStaffs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing || !editing.name.trim()) return;
    try {
      await staffApi.update(editing.id, { name: editing.name.trim() });
      toast.success('Staff updated');
      setEditing(null);
      fetchStaffs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await staffApi.delete(deleteModal.staff.id);
      toast.success('Staff deleted');
      setDeleteModal({ open: false, staff: null });
      fetchStaffs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = staffs.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="page-title">Staffs</h1>
        <p className="text-sm text-slate-500">Manage staff members who perform services.</p>
      </div>

      {/* Add staff */}
      <form onSubmit={handleCreate} className="card">
        <label className="label">Add Staff</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Staff name"
            className="input-field flex-1"
            autoFocus
          />
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 whitespace-nowrap">
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
              placeholder="Search staff…"
              className="input-field pl-9"
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" size="lg" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserGroupIcon} title="No staff" description="Add your first staff member above" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-16">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-40">Added</th>
                  <th className="px-4 py-2.5 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{s.id}</td>
                    <td className="px-4 py-2.5">
                      {editing && editing.id === s.id ? (
                        <input
                          type="text"
                          value={editing.name}
                          onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          className="input-field py-1"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-slate-800">{s.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {editing && editing.id === s.id ? (
                          <>
                            <button onClick={handleUpdate} title="Save" className="p-1.5 rounded text-credit-green hover:bg-slate-100">
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditing(null)} title="Cancel" className="p-1.5 rounded text-slate-400 hover:bg-slate-100">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditing({ id: s.id, name: s.name })} title="Edit" className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteModal({ open: true, staff: s })} title="Delete" className="p-1.5 rounded text-debit-red hover:bg-slate-100">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
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
        onClose={() => setDeleteModal({ open: false, staff: null })}
        title="Delete staff"
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold">{deleteModal.staff?.name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDeleteModal({ open: false, staff: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
