import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ledgerApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function OutstandingBalanceReportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [behaviourFilter, setBehaviourFilter] = useState(searchParams.get('behaviour') || 'all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const outRes = await ledgerApi.getOutstanding();
      setLedgers(outRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return ledgers.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.phone || '').includes(search) ||
        (l.place || '').toLowerCase().includes(search.toLowerCase());
      const matchesBehaviour = behaviourFilter === 'all' || l.behaviour === behaviourFilter;
      return matchesSearch && matchesBehaviour;
    });
  }, [ledgers, search, behaviourFilter]);

  const totalOutstanding = useMemo(() => filtered.reduce((s, l) => s + (l.current_balance || 0), 0), [filtered]);

  const handleExportExcel = () => {
    const columns = [
      { header: 'Name',     key: 'name',            width: 25 },
      { header: 'Type',     key: 'type_name',        width: 15 },
      { header: 'Phone',    key: 'phone',            width: 15 },
      { header: 'Place',    key: 'place',            width: 15 },
      { header: 'Balance',  key: 'current_balance',  width: 15 },
    ];
    exportToExcel(filtered, columns, 'Outstanding_Balances');
  };

  const handleExportPDF = () => {
    const headers = ['Name', 'Type', 'Phone', 'Place', 'Balance'];
    const rows = filtered.map((l) => [
      l.name,
      l.type_name || '',
      l.phone || '',
      l.place || '',
      formatCurrency(l.current_balance || 0).replace('₹', 'Rs. '),
    ]);
    exportToPDF('Outstanding Balance Report', headers, rows, 'Outstanding_Balances');
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CurrencyDollarIcon className="h-6 w-6 text-trust-blue" />
            Outstanding Balances
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ledgers with outstanding balances ({filtered.length})
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-secondary gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />Excel
          </button>
          <button onClick={handleExportPDF} className="btn-secondary gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />PDF
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="card text-center py-4 border-red-200 bg-white">
        <p className="text-xs font-medium text-red-600">Total Outstanding</p>
        <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(totalOutstanding)}</p>
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
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {[['all', 'All'], ['customer', 'Customer'], ['supplier', 'Supplier']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setBehaviourFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                behaviourFilter === val
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
          icon={CurrencyDollarIcon}
          title="No outstanding balances"
          description="All ledgers are settled"
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
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Outstanding</th>
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
                    <td className="px-4 py-2.5 text-slate-600">{l.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.place || '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${(l.current_balance || 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {formatCurrency(l.current_balance || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Total ({filtered.length} ledgers)
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-red-700">
                    {formatCurrency(totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
