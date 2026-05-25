import { useState, useEffect, useCallback, useMemo } from 'react';
import { transactionApi, expenseApi, saleApi, purchaseApi, salesReturnApi, purchaseReturnApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import { exportToExcel } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { QueueListIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const TYPE_OPTIONS = [
  { value: 'all',              label: 'All Entries' },
  { value: 'sale',             label: 'Sales' },
  { value: 'purchase',         label: 'Purchases' },
  { value: 'sales_return',     label: 'Sales Returns' },
  { value: 'purchase_return',  label: 'Purchase Returns' },
  { value: 'transaction',      label: 'Transactions' },
  { value: 'expense',          label: 'Expenses' },
];

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
    type: 'all',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const [txRes, expRes, saleRes, purchaseRes, srRes, prRes] = await Promise.allSettled([
        transactionApi.getAll(params),
        expenseApi.getAll(params),
        saleApi.getAll(params),
        purchaseApi.getAll(params),
        salesReturnApi.getAll(params),
        purchaseReturnApi.getAll(params),
      ]);

      const transactions = txRes.status === 'fulfilled' ? (txRes.value.data || []) : [];
      const expenses     = expRes.status === 'fulfilled' ? (expRes.value.data || []) : [];
      const sales        = saleRes.status === 'fulfilled' ? (saleRes.value.data || []) : [];
      const purchases    = purchaseRes.status === 'fulfilled' ? (purchaseRes.value.data || []) : [];
      const salesRets    = srRes.status === 'fulfilled' ? (srRes.value.data || []) : [];
      const purchRets    = prRes.status === 'fulfilled' ? (prRes.value.data || []) : [];

      const txEntries = transactions.map((tx) => ({
        id: `tx-${tx.id}`,
        type: 'transaction',
        sortKey: tx.id,
        date: tx.date,
        details: tx.ledger_name + (tx.notes ? ` — ${tx.notes}` : ''),
        voucherNo: tx.running_number || `TXN-${String(tx.id).padStart(5, '0')}`,
        debit: tx.entry_type === 'payment' ? tx.amount : 0,
        credit: tx.entry_type === 'receipt' ? tx.amount : 0,
      }));

      const expEntries = expenses.map((exp) => ({
        id: `exp-${exp.id}`,
        type: 'expense',
        sortKey: exp.id,
        date: exp.date,
        details: exp.expense_name + (exp.category_name ? ` [${exp.category_name}]` : ''),
        voucherNo: `EXP-${String(exp.id).padStart(5, '0')}`,
        debit: exp.amount,
        credit: 0,
      }));

      // Sales → Credit (income)
      const saleEntries = sales.map((s) => ({
        id: `sal-${s.id}`,
        type: 'sale',
        sortKey: s.id,
        date: s.date,
        details: `${s.ledger_name} — Sale #${s.sale_number}`,
        voucherNo: `SAL-${String(s.sale_number).padStart(5, '0')}`,
        debit: 0,
        credit: s.total_amount,
      }));

      // Purchases → Debit (expenditure)
      const purchEntries = purchases.map((p) => {
        const billRef = p.bill_number ? ` [Bill: ${p.bill_number}]` : '';
        return {
          id: `pur-${p.id}`,
          type: 'purchase',
          sortKey: p.id,
          date: p.date,
          details: `${p.ledger_name} — Purchase #${p.purchase_number}${billRef}`,
          voucherNo: `PUR-${String(p.purchase_number).padStart(5, '0')}`,
          debit: p.total_amount,
          credit: 0,
        };
      });

      // Sales Returns → Debit (reduces income)
      const srEntries = salesRets.map((r) => {
        const ref = r.sale_number ? ` [Sale #${r.sale_number}]` : '';
        return {
          id: `sr-${r.id}`,
          type: 'sales_return',
          sortKey: r.id,
          date: r.date,
          details: `${r.ledger_name} — Sales Return #${r.return_number}${ref}`,
          voucherNo: `SR-${String(r.return_number).padStart(5, '0')}`,
          debit: r.total_amount,
          credit: 0,
        };
      });

      // Purchase Returns → Credit (reduces expenditure)
      const prEntries = purchRets.map((r) => {
        const ref = r.bill_number
          ? ` [Bill: ${r.bill_number}]`
          : r.purchase_number ? ` [Purchase #${r.purchase_number}]` : '';
        return {
          id: `pr-${r.id}`,
          type: 'purchase_return',
          sortKey: r.id,
          date: r.date,
          details: `${r.ledger_name} — Purchase Return #${r.return_number}${ref}`,
          voucherNo: `PR-${String(r.return_number).padStart(5, '0')}`,
          debit: 0,
          credit: r.total_amount,
        };
      });

      const merged = [...txEntries, ...expEntries, ...saleEntries, ...purchEntries, ...srEntries, ...prEntries]
        .sort((a, b) => {
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
  }, [filters.fromDate, filters.toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (filters.type === 'all') return entries;
    return entries.filter((e) => e.type === filters.type);
  }, [entries, filters.type]);

  const totalDebit  = useMemo(() => filtered.reduce((s, e) => s + e.debit, 0), [filtered]);
  const totalCredit = useMemo(() => filtered.reduce((s, e) => s + e.credit, 0), [filtered]);

  const handleExportExcel = () => {
    const columns = [
      { header: 'S.No',       key: 'sno',       width: 8  },
      { header: 'Date',       key: 'date',      width: 15 },
      { header: 'Details',    key: 'details',   width: 40 },
      { header: 'Voucher No', key: 'voucherNo', width: 18 },
      { header: 'Debit (₹)', key: 'debit',     width: 15 },
      { header: 'Credit (₹)',key: 'credit',    width: 15 },
    ];
    const rows = filtered.map((e, idx) => ({
      sno: idx + 1,
      date: formatDate(e.date),
      details: e.details,
      voucherNo: e.voucherNo,
      debit: e.debit > 0 ? e.debit : '',
      credit: e.credit > 0 ? e.credit : '',
    }));
    exportToExcel(rows, columns, 'Day_Book');
  };

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="page-title">Day Book</h1>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-secondary gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />Excel
          </button>
          <button onClick={fetchData} className="btn-secondary gap-2">
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
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
          <div className="w-48 min-w-[180px] shrink-0">
            <label className="label">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
              className="input-field"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => setFilters({ fromDate: firstDayOfCurrentMonth(), toDate: todayISO(), type: 'all' })}
              className="btn-secondary text-xs h-10 px-3 whitespace-nowrap"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" size="lg" />
      ) : filtered.length === 0 ? (
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
                {filtered.map((entry, idx) => (
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
                    Total ({filtered.length} entries)
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
