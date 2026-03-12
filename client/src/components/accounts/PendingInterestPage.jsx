import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ledgerApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  ClockIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function PendingInterestPage() {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('incoming');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ledgerApi.getPendingInterest();
      setLedgers(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = ledgers.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').includes(search) ||
      (l.place || '').toLowerCase().includes(search.toLowerCase());
    const isIncoming = l.behaviour === 'customer';
    const matchesType = typeFilter === 'incoming' ? isIncoming : !isIncoming;
    return matchesSearch && matchesType;
  });

  const totalPending = filtered.reduce((sum, l) => sum + (l.pending_interest || 0), 0);
  const totalOutstanding = filtered.reduce((sum, l) => sum + (l.current_balance || 0), 0);

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ClockIcon className="h-6 w-6 text-amber-500" />
          Pending Interest
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Ledgers with pending due interest ({filtered.length} ledgers)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`card text-center bg-white ${typeFilter === 'incoming' ? 'border-green-200' : 'border-red-200'}`}>
          <p className={`text-xs font-medium ${typeFilter === 'incoming' ? 'text-green-600' : 'text-red-600'}`}>
            Total Pending Interest ({typeFilter === 'incoming' ? 'Incoming' : 'Outgoing'})
          </p>
          <p className={`text-xl font-bold mt-1 ${typeFilter === 'incoming' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalPending)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Total Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${typeFilter === 'incoming' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Ledgers</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, place…"
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setTypeFilter('incoming')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              typeFilter === 'incoming'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-green-600'
            }`}
          >
            Incoming
          </button>
          <button
            onClick={() => setTypeFilter('outgoing')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              typeFilter === 'outgoing'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-red-600'
            }`}
          >
            Outgoing
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClockIcon}
          title="No pending interest"
          description="All ledgers are up to date with interest"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Ledger Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Current Balance</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Pending Interest</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Pending Count</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Interest Rate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/ledger/${l.id}`)}
                    className="border-b border-slate-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">{l.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.behaviour === 'customer' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {l.type_name || 'Unknown'}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${l.behaviour === 'customer' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(l.current_balance)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${l.behaviour === 'customer' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(l.pending_interest)}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">{l.pending_count}</td>
                    <td className="px-4 py-2.5 text-slate-500">{l.interest_rate}% {l.interest_scheme}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
