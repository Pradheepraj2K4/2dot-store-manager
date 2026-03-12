import { useState, useEffect, useCallback } from 'react';
import { interestApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

function firstOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function PaidInterestPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(firstOfMonthISO);
  const [toDate, setToDate] = useState(todayISO);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState('incoming');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await interestApi.getAll({ status: 'paid', fromDate, toDate });
      setEntries(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = entries.filter((e) => {
    const matchesSearch = !search || (e.ledger_name || '').toLowerCase().includes(search.toLowerCase());
    const isIncoming = e.behaviour === 'customer';
    const matchesDir = dirFilter === 'incoming' ? isIncoming : !isIncoming;
    return matchesSearch && matchesDir;
  });

  const totalPaid = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <CheckCircleIcon className="h-6 w-6 text-green-500" />
          Paid Interest
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          All interest entries that have been marked as paid
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className={`card text-center bg-white ${dirFilter === 'incoming' ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}`}>
          <p className={`text-xs font-medium ${dirFilter === 'incoming' ? 'text-green-700' : 'text-red-700'}`}>Total Paid (filtered)</p>
          <p className={`text-xl font-bold mt-1 ${dirFilter === 'incoming' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Entries</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ledger name…"
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setDirFilter('incoming')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              dirFilter === 'incoming'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-green-600'
            }`}
          >
            Incoming
          </button>
          <button
            onClick={() => setDirFilter('outgoing')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              dirFilter === 'outgoing'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-red-600'
            }`}
          >
            Outgoing
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input-field text-sm py-2 w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input-field text-sm py-2 w-36"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircleIcon}
          title="No paid interest"
          description="No interest entries found for the selected period"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold">Ledger</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold">Period</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold">Principal</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{e.ledger_name}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">
                      {e.from_date === e.to_date
                        ? formatDate(e.from_date)
                        : `${formatDate(e.from_date)} – ${formatDate(e.to_date)}`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                      {formatCurrency(e.principal_at_time)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${e.behaviour === 'customer' ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {e.paid_date ? formatDate(e.paid_date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 ${dirFilter === 'incoming' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <td colSpan={3} className={`px-4 py-2 text-xs font-semibold ${dirFilter === 'incoming' ? 'text-green-700' : 'text-red-700'}`}>Total</td>
                  <td className={`px-4 py-2 text-right font-bold ${dirFilter === 'incoming' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalPaid)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
