import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ledgerApi, accountApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  BookOpenIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

const GST_REGEX   = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PHONE_REGEX = /^\d{10}$/;
const STATE_REGEX = /^\d{2}$/;

function validateForm(form) {
  const errors = {};
  if (!form.type) errors.type = 'Please select ledger type.';
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  if (form.phone && !PHONE_REGEX.test(form.phone.replace(/\s/g, ''))) errors.phone = 'Enter a valid 10-digit number.';
  if (form.gst_no && !GST_REGEX.test(form.gst_no.trim().toUpperCase())) errors.gst_no = 'Invalid GST number.';
  if (form.state_code && !STATE_REGEX.test(form.state_code.trim())) errors.state_code = 'State code must be 2 digits.';
  if (form.gst_no && !form.state_code) errors.state_code = 'Required when GST is set.';
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

export default function LedgerListPage() {
  const [ledgers, setLedgers] = useState([]);
  const [accountInfo, setAccountInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'customer' | 'supplier'
  const [editModal, setEditModal] = useState({ open: false, ledger: null });
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ledgersRes, outstandingRes] = await Promise.all([
        ledgerApi.getAll(),
        accountApi.getOutstanding(),
      ]);
      setLedgers(ledgersRes.data);
      const infoMap = {};
      outstandingRes.data.forEach((b) => { infoMap[b.ledger_id || b.id] = b; });
      setAccountInfo(infoMap);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (ledger) => {
    setEditForm({
      type: ledger.type,
      name: ledger.name,
      phone: ledger.phone || '',
      place: ledger.place || '',
      address: ledger.address || '',
      gst_no: ledger.gst_no || '',
      state_code: ledger.state_code || '',
      igst_status: ledger.igst_status || 'NO',
    });
    setEditErrors({});
    setEditTouched({});
    setEditModal({ open: true, ledger });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    const next = { ...editForm, [name]: value };
    setEditForm(next);
    if (editTouched[name]) setEditErrors(validateForm(next));
  };

  const handleEditBlur = (e) => {
    const { name } = e.target;
    setEditTouched((p) => ({ ...p, [name]: true }));
    setEditErrors(validateForm(editForm));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(editForm);
    setEditErrors(errs);
    setEditTouched(Object.fromEntries(Object.keys(editForm).map((k) => [k, true])));
    if (Object.keys(errs).length > 0) return;
    try {
      await ledgerApi.update(editModal.ledger.id, {
        ...editForm,
        name: editForm.name.trim(),
        gst_no: editForm.gst_no.trim().toUpperCase(),
        state_code: editForm.state_code.trim(),
      });
      toast.success('Ledger updated successfully');
      setEditModal({ open: false, ledger: null });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await ledgerApi.delete(id);
      toast.success('Ledger deleted successfully');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = ledgers.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.place || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || l.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Ledgers</h1>
          <p className="text-sm text-slate-500 mt-1">
            All customer &amp; supplier ledger accounts ({filtered.length})
          </p>
        </div>
        <button onClick={() => navigate('/ledger-creation')} className="btn-primary gap-2">
          <PlusIcon className="h-4 w-4" />
          New Ledger
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ledgers…"
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[['all', 'All'], ['customer', 'Customers'], ['supplier', 'Suppliers']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === val
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="No ledgers found"
          description={search ? 'Try a different search term' : 'Create your first ledger to get started'}
          action={
            !search && (
              <button onClick={() => navigate('/ledger-creation')} className="btn-primary gap-2">
                <PlusIcon className="h-4 w-4" />
                New Ledger
              </button>
            )
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Place</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Accounts</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Outstanding</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ledger) => {
                  const info = accountInfo[ledger.id];
                  const outstanding = info ? (info.total_outstanding || 0) : 0;
                  const acctCount = info ? (info.account_count || 0) : 0;
                  return (
                    <tr key={ledger.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{ledger.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ledger.type === 'customer'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ledger.type === 'customer' ? 'Customer' : 'Supplier'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{ledger.phone || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{ledger.place || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {acctCount}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${outstanding > 0 ? 'text-debit-red' : 'text-slate-400'}`}>
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/ledger/${ledger.id}`)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                            title="View Ledger"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(ledger)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(ledger)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-debit-red transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, ledger: null })}
        title="Edit Ledger"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
          {/* Type */}
          <div>
            <label className="label">Ledger Type *</label>
            <select
              name="type"
              value={editForm.type || ''}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              className={`input-field ${editErrors.type ? 'border-red-400' : ''}`}
            >
              <option value="">— Select type —</option>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
            </select>
            <FieldError msg={editErrors.type} />
          </div>
          {/* Name */}
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              name="name"
              value={editForm.name || ''}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              className={`input-field ${editErrors.name ? 'border-red-400' : ''}`}
            />
            <FieldError msg={editErrors.name} />
          </div>
          {/* Phone + Place */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input type="text" name="phone" value={editForm.phone || ''} onChange={handleEditChange} onBlur={handleEditBlur} className={`input-field ${editErrors.phone ? 'border-red-400' : ''}`} maxLength={10} />
              <FieldError msg={editErrors.phone} />
            </div>
            <div>
              <label className="label">Place</label>
              <input type="text" name="place" value={editForm.place || ''} onChange={handleEditChange} className="input-field" />
            </div>
          </div>
          {/* Address */}
          <div>
            <label className="label">Address</label>
            <textarea name="address" value={editForm.address || ''} onChange={handleEditChange} rows={2} className="input-field resize-none" />
          </div>
          {/* GST + State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">GST Number</label>
              <input type="text" name="gst_no" value={editForm.gst_no || ''} onChange={handleEditChange} onBlur={handleEditBlur} className={`input-field uppercase ${editErrors.gst_no ? 'border-red-400' : ''}`} maxLength={15} />
              <FieldError msg={editErrors.gst_no} />
            </div>
            <div>
              <label className="label">State Code</label>
              <input type="text" name="state_code" value={editForm.state_code || ''} onChange={handleEditChange} onBlur={handleEditBlur} className={`input-field ${editErrors.state_code ? 'border-red-400' : ''}`} maxLength={2} />
              <FieldError msg={editErrors.state_code} />
            </div>
          </div>
          {/* IGST */}
          <div>
            <label className="label">IGST Applicable</label>
            <div className="flex gap-6 mt-1">
              {['YES', 'NO'].map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="igst_status" value={opt} checked={editForm.igst_status === opt} onChange={handleEditChange} className="text-trust-blue focus:ring-trust-blue" />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal({ open: false, ledger: null })} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Ledger"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This will also
          delete all associated accounts and payments. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
