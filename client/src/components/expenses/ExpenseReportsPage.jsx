import { useState, useEffect, useCallback } from 'react';
import { expenseApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import { DocumentChartBarIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';

function firstDayOfCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function ExpenseReportsPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ open: false, expense: null });
  const [filters, setFilters] = useState({
    fromDate: firstDayOfCurrentMonth(),
    toDate: todayISO(),
    categoryId: '',
    expenseName: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate)   params.toDate   = filters.toDate;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.expenseName) params.expenseName = filters.expenseName;

      const [expRes, catRes, sumRes] = await Promise.all([
        expenseApi.getAll(params),
        expenseApi.getCategories(),
        expenseApi.getSummary({ fromDate: params.fromDate, toDate: params.toDate }),
      ]);
      setExpenses(expRes.data || []);
      setCategories(catRes.data || []);
      setSummary(sumRes.data || null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    try {
      await expenseApi.delete(deleteModal.expense.id);
      toast.success('Expense deleted');
      setDeleteModal({ open: false, expense: null });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Group expenses by date for date-wise display
  const byDate = expenses.reduce((acc, exp) => {
    const d = exp.date;
    if (!acc[d]) acc[d] = { date: d, items: [], total: 0 };
    acc[d].items.push(exp);
    acc[d].total += exp.amount;
    return acc;
  }, {});
  const sortedDates = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Expense Reports</h1>
        </div>
        <button onClick={fetchData} className="btn-secondary gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card py-3">
        <div className="flex flex-wrap items-end gap-2 pb-1">
          <div className="w-52 min-w-[180px] shrink-0">
            <label className="label">Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))}
              className="input-field"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="label">Expense Name</label>
            <input
              type="text"
              value={filters.expenseName}
              onChange={(e) => setFilters((p) => ({ ...p, expenseName: e.target.value }))}
              className="input-field"
              placeholder="Search by name"
            />
          </div>
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
              onClick={() => setFilters({ fromDate: firstDayOfCurrentMonth(), toDate: todayISO(), categoryId: '', expenseName: '' })}
              className="btn-secondary text-xs h-10 px-3 whitespace-nowrap"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" size="lg" />
      ) : (
        <>
          {/* Summary + Breakdown */}
          {/* {expenses.length > 0 && (
            <div className="card py-2.5">
              <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap pb-2 mb-2 border-b border-slate-100 text-xs">
                <div className="shrink-0">
                  <span className="text-slate-500 mr-1">Total</span>
                  <span className="font-bold text-orange-600">{formatCurrency(grandTotal)}</span>
                  <span className="text-slate-400 ml-1">({expenses.length})</span>
                </div>
                {summary?.byCategory?.map((cat) => (
                  <div key={cat.category_name || 'uncategorised'} className="shrink-0">
                    <span className="text-slate-500 mr-1">{cat.category_name || 'Uncategorised'}</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
              {summary?.byCategory?.length > 0 && (
                <div className="space-y-1">
                  {summary.byCategory.map((cat) => {
                    const pct = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
                    return (
                      <div key={cat.category_name || 'uncategorised'}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium text-slate-600">{cat.category_name || 'Uncategorised'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">{cat.count} entries</span>
                            <span className="font-semibold text-orange-700 w-20 text-right">{formatCurrency(cat.total)}</span>
                            <span className="text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )} */}

          {/* Expense Table */}
          {sortedDates.length === 0 ? (
            <EmptyState
              icon={DocumentChartBarIcon}
              title="No expenses found"
              description="Try adjusting your filters"
            />
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 330px)' }}>
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr className="text-slate-600 text-xs">
                      <th className="px-3 py-2 text-center font-semibold border-b border-slate-200 w-10">S.No</th>
                      <th className="px-3 py-2 text-left font-semibold border-b border-slate-200 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left font-semibold border-b border-slate-200">Expense Name</th>
                      <th className="px-3 py-2 text-left font-semibold border-b border-slate-200">Category</th>
                      <th className="px-3 py-2 text-left font-semibold border-b border-slate-200">Notes</th>
                      <th className="px-3 py-2 text-right font-semibold border-b border-slate-200">Amount</th>
                      <th className="px-3 py-2 border-b border-slate-200 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp, idx) => (
                      <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50 last:border-0">
                        <td className="px-3 py-1.5 text-center text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">{formatDate(exp.date)}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{exp.expense_name}</td>
                        <td className="px-3 py-1.5">
                          {exp.category_name ? (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">
                              {exp.category_name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 text-xs max-w-[200px] truncate">
                          {exp.notes || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-orange-700 whitespace-nowrap">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() => setDeleteModal({ open: true, expense: exp })}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-orange-400">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-white">
                        Grand Total ({expenses.length} entries)
                      </td>
                      <td className="px-3 py-2.5 text-right text-base font-bold text-white whitespace-nowrap">
                        {formatCurrency(grandTotal)}
                      </td>
                      <td className="bg-orange-400" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, expense: null })} title="Delete Expense" size="sm">
        {deleteModal.expense && (
          <>
            <p className="text-sm text-slate-600 mb-6">
              Delete <strong>{deleteModal.expense.expense_name}</strong> ({formatCurrency(deleteModal.expense.amount)} on {formatDate(deleteModal.expense.date)})?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal({ open: false, expense: null })} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
