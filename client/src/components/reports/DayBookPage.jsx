import { useState, useEffect, useCallback, useMemo } from 'react';
import { transactionApi, expenseApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { QueueListIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

function firstDayOfCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function DayBookPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    fromDate: firstDayOfCurrentMonth(),
    toDate: todayISO(),
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const [txRes, expRes] = await Promise.allSettled([
        transactionApi.getAll(params),
        expenseApi.getAll(params),
      ]);

      const transactions = txRes.status === 'fulfilled' ? (txRes.value.data || []) : [];
      const expenses = expRes.status === 'fulfilled' ? (expRes.value.data || []) : [];

      const txEntries = transactions.map((tx) => ({
        id: `tx-${tx.id}`,
        sortKey: tx.id,
        date: tx.date,
        details: tx.ledger_name + (tx.notes ? ` — ${tx.notes}` : ''),
        voucherNo: tx.running_number || `TXN-${String(tx.id).padStart(5, '0')}`,
        debit: tx.entry_type === 'payment' ? tx.amount : 0,
        credit: tx.entry_type === 'receipt' ? tx.amount : 0,
      }));

      const expEntries = expenses.map((exp) => ({
        id: `exp-${exp.id}`,
        sortKey: exp.id,
        date: exp.date,
        details: exp.expense_name + (exp.category_name ? ` [${exp.category_name}]` : ''),
        voucherNo: `EXP-${String(exp.id).padStart(5, '0')}`,
        debit: exp.amount,
        credit: 0,
      }));

      const merged = [...txEntries, ...expEntries].sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return b.sortKey - a.sortKey;
      });

      setEntries(merged);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDebit = useMemo(() => entries.reduce((s, e) => s + e.debit, 0), [entries]);
  const totalCredit = useMemo(() => entries.reduce((s, e) => s + e.credit, 0), [entries]);

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="page-title">Day Book</h1>
        <button onClick={fetchData} className="btn-secondary gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card py-3">
        <div className="flex flex-wrap items-end gap-2 pb-1">
          <div className="w-44 min-w-[160px] shrink-0">
            <label className="label">From Date</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="w-44 min-w-[160px] shrink-0">
            <label className="label">To Date</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="shrink-0">
            <button
              onClick={() => setFilters({ fromDate: firstDayOfCurrentMonth(), toDate: todayISO() })}
              className="btn-secondary text-xs h-10 px-3 whitespace-nowrap"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" size="lg" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={QueueListIcon}
          title="No transactions found"
          description="Try adjusting your date filters"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr className="text-slate-600 text-xs">
                  <th className="px-3 py-2 text-center font-semibold border-b border-slate-200 w-10">S.No</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-slate-200 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-slate-200">Details</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-slate-200 whitespace-nowrap">Voucher No.</th>
                  <th className="px-3 py-2 text-right font-semibold border-b border-slate-200 whitespace-nowrap">Debit (₹)</th>
                  <th className="px-3 py-2 text-right font-semibold border-b border-slate-200 whitespace-nowrap">Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50 last:border-0">
                    <td className="px-3 py-1.5 text-center text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-3 py-1.5 text-slate-800 font-medium">{entry.details}</td>
                    <td className="px-3 py-1.5 text-xs font-mono text-slate-500">{entry.voucherNo}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-red-600 whitespace-nowrap">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-green-600 whitespace-nowrap">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-slate-700">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-sm font-semibold text-white">
                    Total ({entries.length} entries)
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-bold text-red-300 whitespace-nowrap">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-bold text-green-300 whitespace-nowrap">
                    {formatCurrency(totalCredit)}
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
