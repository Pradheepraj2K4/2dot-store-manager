import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../../api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const PERMISSION_DEFS = [
  { key: 'can_create', label: 'Create', hint: 'Add new records' },
  { key: 'can_modify', label: 'Modify', hint: 'Edit existing records' },
  { key: 'can_delete', label: 'Delete', hint: 'Remove records' },
  { key: 'can_manage_settings', label: 'Manage Settings & Users', hint: 'Access settings and user management' },
];

const emptyForm = () => ({
  username: '',
  password: '',
  can_create: false,
  can_modify: false,
  can_delete: false,
  can_manage_settings: false,
});

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-left"
    >
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-trust-blue' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function UsersSettings() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, user: null });
  const [editForm, setEditForm] = useState(emptyForm());
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await userApi.getAll();
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) { toast.error('Username is required'); return; }
    if (!form.password.trim()) { toast.error('Password is required'); return; }
    try {
      setSaving(true);
      await userApi.create(form);
      toast.success('User created');
      setForm(emptyForm());
      setShowPassword(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user) => {
    setEditForm({
      username: user.username,
      password: '',
      can_create: !!user.can_create,
      can_modify: !!user.can_modify,
      can_delete: !!user.can_delete,
      can_manage_settings: !!user.can_manage_settings,
    });
    setEditShowPassword(false);
    setEditModal({ open: true, user });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.username.trim()) { toast.error('Username is required'); return; }
    try {
      setSaving(true);
      await userApi.update(editModal.user.id, editForm);
      toast.success('User updated');
      setEditModal({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await userApi.delete(deleteModal.user.id);
      toast.success('User deleted');
      setDeleteModal({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const grantedCount = (u) =>
    PERMISSION_DEFS.filter((p) => u[p.key]).length;

  return (
    <div className="space-y-3">
      {/* Create user */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <UsersIcon className="h-5 w-5 text-trust-blue" />
          <h2 className="text-base font-semibold text-slate-900">Add User</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Create operators with their own password. All permissions are disabled by default — enable only what each user needs.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="input-field"
                placeholder="e.g. cashier1"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Password *</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="input-field flex-1"
                  placeholder="Set a password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Permissions</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSION_DEFS.map((p) => (
                <Toggle
                  key={p.key}
                  label={p.label}
                  hint={p.hint}
                  checked={form[p.key]}
                  onChange={(v) => setForm((prev) => ({ ...prev, [p.key]: v }))}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary text-sm gap-1">
            <PlusIcon className="h-4 w-4" />
            {saving ? 'Saving…' : 'Create User'}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Users</h2>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-4">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No users yet</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{u.username}</span>
                    <span className="text-xs text-slate-400">({grantedCount(u)} permission{grantedCount(u) !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {PERMISSION_DEFS.filter((p) => u[p.key]).map((p) => (
                      <span key={p.key} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-medium">
                        <CheckIcon className="h-3 w-3" />{p.label}
                      </span>
                    ))}
                    {grantedCount(u) === 0 && (
                      <span className="text-[11px] text-slate-400">No permissions</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(u)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, user: u })}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, user: null })}
        title="Edit User"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="label">Username *</label>
            <input
              type="text"
              value={editForm.username}
              onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
              className="input-field"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="flex items-center gap-2">
              <input
                type={editShowPassword ? 'text' : 'password'}
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                className="input-field flex-1"
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setEditShowPassword((v) => !v)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                {editShowPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Permissions</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSION_DEFS.map((p) => (
                <Toggle
                  key={p.key}
                  label={p.label}
                  hint={p.hint}
                  checked={editForm[p.key]}
                  onChange={(v) => setEditForm((prev) => ({ ...prev, [p.key]: v }))}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal({ open: false, user: null })} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, user: null })}
        title="Delete User"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete user <strong>{deleteModal.user?.username}</strong>? They will no longer be able to sign in.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModal({ open: false, user: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
