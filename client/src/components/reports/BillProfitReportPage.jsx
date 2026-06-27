import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { saleApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  PresentationChartLineIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function BillProfitReportPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await saleApi.getBillProfit({ fromDate, toDate });
      setRows(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load bill profit');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.sale_number || '').toLowerCase().includes(q) ||
      (r.party_name || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => {
      acc.sale += r.sale_value || 0;
      acc.cost += r.cost || 0;
      acc.profit += r.profit || 0;
      return acc;
    },
    { sale: 0, cost: 0, profit: 0 }
  ), [filtered]);

  const hasIncomplete = useMemo(() => filtered.some((r) => r.unknown_cost_lines > 0), [filtered]);

  const handleExportExcel = () => {
    const columns = [
      { header: 'Bill No', key: 'sale_number', width: 12 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Party', key: 'party_name', width: 25 },
      { header: 'Items', key: 'item_count', width: 8 },
      { header: 'Sale Value', key: 'sale_value', width: 14 },
      { header: 'Cost', key: 'cost', width: 14 },
      { header: 'Profit', key: 'profit', width: 14 },
    ];
    exportToExcel(filtered, columns, 'Bill_Profit_Report');
  };

  const handleExportPDF = () => {
    const headers = ['Bill No', 'Date', 'Party', 'Items', 'Sale Value', 'Cost', 'Profit'];
    const data = filtered.map((r) => [
      r.sale_number,
      fmtDate(r.date),
      r.party_name || '',
      r.item_count ?? '',
      formatCurrency(r.sale_value || 0).replace('₹', 'Rs. '),
      formatCurrency(r.cost || 0).replace('₹', 'Rs. '),
      formatCurrency(r.profit || 0).replace('₹', 'Rs. '),
    ]);
    exportToPDF('Bill Profit Report', headers, data, 'Bill_Profit_Report');
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <PresentationChartLineIcon className="h-6 w-6 text-trust-blue" />
            Bill Profit Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Profit per bill ({filtered.length}) — sale value minus weighted-average purchase cost
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="card text-center py-4 bg-white border-slate-200">
          <p className="text-xs font-medium text-slate-500">Sale Value</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(totals.sale)}</p>
        </div>
        <div className="card text-center py-4 bg-white border-slate-200">
          <p className="text-xs font-medium text-slate-500">Cost</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(totals.cost)}</p>
        </div>
        <div className={`card text-center py-4 bg-white ${totals.profit >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <p className="text-xs font-medium text-slate-500">Profit</p>
          <p className={`text-xl font-bold mt-1 ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</p>
        </div>
      </div>

      {hasIncomplete && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Bills marked with <span className="font-semibold">*</span> contain items with no purchase history,
            so their cost (and profit) is understated.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="input-field" />
        </div>
        <div className="relative flex-1 max-w-md">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <MagnifyingGlassIcon className="absolute left-3 top-[34px] h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bill no or party…"
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={PresentationChartLineIcon}
          title="No bills in this range"
          description="Adjust the date range to see bill-wise profit"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Bill No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Party</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Sale Value</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Profit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/item-sales/${r.id}/edit`)}
                    className="border-b border-slate-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-slate-700">
                      {r.sale_number}
                      {r.unknown_cost_lines > 0 ? <span className="text-amber-500 font-bold" title="Some items have no purchase cost">*</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.party_name || '—'}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">{r.item_count ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(r.sale_value || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{formatCurrency(r.cost || 0)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${(r.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(r.profit || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Total ({filtered.length} bills)
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-800">{formatCurrency(totals.sale)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-amber-600">{formatCurrency(totals.cost)}</td>
                  <td className={`px-4 py-2.5 text-right text-sm font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
