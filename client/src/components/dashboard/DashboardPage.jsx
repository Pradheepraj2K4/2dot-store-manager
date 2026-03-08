import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import StatCard from '../ui/StatCard';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ArrowPathIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getSummary();
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (!data) return null;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <button onClick={fetchDashboard} className="btn-secondary gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard
          title="Total Ledgers"
          value={data.totalLedgers}
          icon={BookOpenIcon}
          color="slate"
        />
        <StatCard
          title="Active Ledgers"
          value={data.activeLedgers}
          icon={BanknotesIcon}
          color="blue"
        />
        <StatCard
          title="Total Receivable"
          value={formatCurrency(data.totalReceivable)}
          subtitle="From customers"
          icon={ArrowTrendingUpIcon}
          color="green"
        />
        <StatCard
          title="Total Payable"
          value={formatCurrency(data.totalPayable)}
          subtitle="To suppliers"
          icon={ArrowTrendingDownIcon}
          color="red"
        />
      </div>

      {/* Expense Summary (shown when expense module is enabled) */}
      {data.expenseSummary && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Expenses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="card text-center border-l-4 border-l-orange-400">
              <p className="text-xs font-medium text-slate-500">Today's Expenses</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(data.expenseSummary.todayTotal)}</p>
            </div>
            <div className="card text-center border-l-4 border-l-orange-400">
              <p className="text-xs font-medium text-slate-500">This Month's Expenses</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(data.expenseSummary.monthTotal)}</p>
            </div>
            {data.expenseSummary.byCategory?.length > 0 && (
              <div className="card border-l-4 border-l-orange-200">
                <p className="text-xs font-medium text-slate-500 mb-2">Top Category (This Month)</p>
                <p className="text-sm font-semibold text-slate-800">{data.expenseSummary.byCategory[0].category_name || 'Uncategorised'}</p>
                <p className="text-lg font-bold text-orange-600 mt-0.5">{formatCurrency(data.expenseSummary.byCategory[0].total)}</p>
              </div>
            )}
          </div>
          {data.expenseSummary.byCategory?.length > 1 && (
            <div className="card mt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Month Expenses by Category</h3>
              <div className="space-y-2">
                {data.expenseSummary.byCategory.map((cat) => {
                  const pct = data.expenseSummary.monthTotal > 0
                    ? (cat.total / data.expenseSummary.monthTotal) * 100
                    : 0;
                  return (
                    <div key={cat.category_name || 'uncategorised'}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{cat.category_name || 'Uncategorised'}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">{cat.count} entries</span>
                          <span className="font-semibold text-orange-700">{formatCurrency(cat.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outstanding by Ledger Type - clickable cards */}
      {data.outstandingByType && data.outstandingByType.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-2">Outstanding Balances by Ledger Type</h2>
          <div className="grid grid-cols-1 mb-2 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.outstandingByType.map((t) => (
              <div
                key={t.id}
                className="card cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: t.behaviour === 'customer' ? '#3b82f6' : '#ef4444' }}
                onClick={() => navigate(`/outstanding-balances?typeId=${t.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{t.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{t.behaviour} · {t.count} ledger{t.count !== 1 ? 's' : ''}</p>
                  </div>
                  <p className={`text-lg font-bold ${t.behaviour === 'customer' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(t.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Top Outstanding */}
        <div className="card flex flex-col" style={{ height: '22rem' }}>
          <h2 className="text-base font-semibold text-slate-900 mb-3 shrink-0">Top Outstanding Ledgers</h2>
          {data.topOutstanding.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No outstanding balances</p>
          ) : (
            <div className="overflow-y-auto flex-1 -mr-1 pr-1">
              {data.topOutstanding.map((ledger) => (
                <div
                  key={ledger.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors rounded px-1"
                  onClick={() => navigate(`/ledger/${ledger.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{ledger.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{ledger.type_name} · {ledger.behaviour}</p>
                  </div>
                  <span className="text-sm font-semibold ml-3 shrink-0 text-debit-red">
                    {formatCurrency(Math.abs(ledger.current_balance))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card flex flex-col" style={{ height: '22rem' }}>
          <h2 className="text-base font-semibold text-slate-900 mb-3 shrink-0">Recent Transactions</h2>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No transactions yet</p>
          ) : (
            <div className="overflow-y-auto flex-1 -mr-1 pr-1">
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.ledger_name}</p>
                    <p className="text-xs text-slate-400">{formatDate(tx.date)} · {tx.running_number}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`text-sm font-semibold ${
                      tx.entry_type === 'payment' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(tx.amount)}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{tx.entry_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
