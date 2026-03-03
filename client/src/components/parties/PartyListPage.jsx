import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { partyApi, transactionApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import Modal from '../ui/Modal';
import PartyForm from './PartyForm';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
  TruckIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

export default function PartyListPage({ partyType }) {
  const [parties, setParties] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  const typeLabel = partyType === 'customer' ? 'Customer' : 'Supplier';
  const TypeIcon = partyType === 'customer' ? UserGroupIcon : TruckIcon;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [partiesRes, outstandingRes] = await Promise.all([
        partyApi.getAll(partyType),
        transactionApi.getOutstanding(),
      ]);
      setParties(partiesRes.data);
      const balMap = {};
      outstandingRes.data.forEach((b) => {
        balMap[b.id] = b;
      });
      setBalances(balMap);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [partyType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (formData) => {
    try {
      await partyApi.create(formData);
      toast.success(`${typeLabel} created successfully`);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async (formData) => {
    try {
      await partyApi.update(editingParty.id, formData);
      toast.success(`${typeLabel} updated successfully`);
      setEditingParty(null);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await partyApi.delete(id);
      toast.success(`${typeLabel} deleted successfully`);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (party) => {
    setEditingParty(party);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingParty(null);
    setModalOpen(true);
  };

  const filtered = parties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.toLowerCase().includes(search.toLowerCase()) ||
      p.place.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">{typeLabel}s</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your {partyType} accounts ({filtered.length})
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary gap-2">
          <PlusIcon className="h-4 w-4" />
          Add {typeLabel}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${partyType}s...`}
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={TypeIcon}
          title={`No ${partyType}s found`}
          description={search ? 'Try a different search term' : `Add your first ${partyType} to get started`}
          action={
            !search && (
              <button onClick={openCreate} className="btn-primary gap-2">
                <PlusIcon className="h-4 w-4" />
                Add {typeLabel}
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
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Place</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Opening Bal.</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Current Balance</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((party) => {
                  const bal = balances[party.id];
                  const currentBal = bal ? bal.current_balance : party.opening_balance;
                  return (
                    <tr key={party.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{party.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{party.phone || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{party.place || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {formatCurrency(party.opening_balance)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${currentBal >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                        {formatCurrency(currentBal)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/ledger/${party.id}`)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                            title="View Ledger"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(party)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(party)}
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

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingParty(null);
        }}
        title={editingParty ? `Edit ${typeLabel}` : `New ${typeLabel}`}
      >
        <PartyForm
          party={editingParty}
          partyType={partyType}
          onSubmit={editingParty ? handleUpdate : handleCreate}
          onCancel={() => {
            setModalOpen(false);
            setEditingParty(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={`Delete ${typeLabel}`}
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This will also
          delete all associated transactions. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
