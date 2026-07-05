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
  ClockIcon,
  ChevronDownIcon,
  SparklesIcon,
  ShoppingBagIcon,
  ReceiptPercentIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  FireIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null); // 'customer' | 'supplier' | null

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <button onClick={fetchDashboard} className="btn-secondary gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 gap-2 ${data.interestEnabled ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <StatCard
          title="Active Ledgers"
          value={data.activeLedgers}
          icon={BookOpenIcon}
          color="blue"
        />
        {/* Customer outstanding card */}
        <div
          className={`card flex items-start gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${
            expandedCard === 'customer' ? 'ring-2 ring-emerald-400' : ''
          }`}
          onClick={() => setExpandedCard(expandedCard === 'customer' ? null : 'customer')}
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-credit-green">
            <ArrowTrendingUpIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 truncate">Customer Outstanding</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(data.customerOutstanding)}</p>
            {data.interestEnabled && (
              <p className="mt-0.5 text-xs text-slate-400">Principal + pending interest</p>
            )}
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-slate-400 mt-1 shrink-0 transition-transform ${expandedCard === 'customer' ? 'rotate-180' : ''}`} />
        </div>
        {/* Supplier outstanding card */}
        <div
          className={`card flex items-start gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${
            expandedCard === 'supplier' ? 'ring-2 ring-rose-400' : ''
          }`}
          onClick={() => setExpandedCard(expandedCard === 'supplier' ? null : 'supplier')}
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-debit-red">
            <ArrowTrendingDownIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 truncate">Supplier Outstanding</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(data.supplierOutstanding)}</p>
            {data.interestEnabled && (
              <p className="mt-0.5 text-xs text-slate-400">Principal + pending interest</p>
            )}
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-slate-400 mt-1 shrink-0 transition-transform ${expandedCard === 'supplier' ? 'rotate-180' : ''}`} />
        </div>
        {/* Profit card — interest module only */}
        {data.interestEnabled && (
          <div className="card flex items-start gap-4">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
              data.interestProfit >= 0 ? 'bg-violet-50' : 'bg-orange-50'
            }`}>
              <SparklesIcon className={`h-5 w-5 ${
                data.interestProfit >= 0 ? 'text-violet-500' : 'text-orange-500'
              }`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500 truncate">Interest Profit</p>
              <p className={`mt-1 text-xl font-bold ${
                data.interestProfit >= 0 ? 'text-violet-700' : 'text-orange-600'
              }`}>
                {formatCurrency(Math.abs(data.interestProfit))}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {data.interestProfit >= 0 ? 'Customer − Supplier interest' : 'Supplier exceeds customer interest'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Expandable breakdown */}
      {expandedCard && (() => {
        const isCustomer = expandedCard === 'customer';
        const principal = isCustomer ? data.customerPrincipal : data.supplierPrincipal;
        const interest = isCustomer ? data.customerPendingInterest : data.supplierPendingInterest;
        const colour = isCustomer ? 'emerald' : 'rose';
        const textColour = isCustomer ? 'text-emerald-700' : 'text-rose-700';
        const bgColour = isCustomer ? 'bg-emerald-50' : 'bg-rose-50';
        const borderColour = isCustomer ? 'border-emerald-200' : 'border-rose-200';
        const behaviourLabel = isCustomer ? 'Customer' : 'Supplier';
        return (
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-xl p-3 ${bgColour} ${borderColour}`}>
            <div
              className="card cursor-pointer hover:shadow-md transition-shadow flex items-start gap-4"
              onClick={() => navigate(`/outstanding-balances?behaviour=${expandedCard}`)}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${bgColour}`}>
                <BanknotesIcon className={`h-5 w-5 ${textColour}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Principal Amount</p>
                <p className={`text-xl font-bold mt-1 ${textColour}`}>{formatCurrency(principal)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Click to view {behaviourLabel} outstanding balances</p>
              </div>
            </div>
            {data.interestEnabled && (
              <div
                className="card cursor-pointer hover:shadow-md transition-shadow flex items-start gap-4"
                onClick={() => navigate(`/pending-interest?type=${isCustomer ? 'incoming' : 'outgoing'}`)}
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${bgColour}`}>
                  <ClockIcon className={`h-5 w-5 ${textColour}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Pending Interest</p>
                  <p className={`text-xl font-bold mt-1 ${textColour}`}>{formatCurrency(interest)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click to view {behaviourLabel} pending interest</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Sales overview (always shown) */}
      {data.salesSummary && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-slate-900">Sales</h2>
            <button
              onClick={() => navigate('/sales-report')}
              className="text-xs font-medium text-trust-blue hover:underline"
            >
              View sales report →
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* Left: compact stat cards stacked */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {/* Today's sales — gradient hero */}
              <div
                onClick={() => navigate('/sales-report')}
                className="relative overflow-hidden rounded-xl p-4 cursor-pointer text-white shadow-sm hover:shadow-md transition-all duration-150 bg-gradient-to-br from-trust-blue to-blue-600 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-100">Today's Sales</span>
                  <ShoppingBagIcon className="h-5 w-5 text-blue-100/80" />
                </div>
                <p className="text-2xl font-bold mt-3 leading-tight">{formatCurrency(data.salesSummary.todayTotal)}</p>
                <span className="mt-1 text-xs text-blue-100">
                  {data.salesSummary.todayCount} bill{data.salesSummary.todayCount !== 1 ? 's' : ''} today
                </span>
                <ShoppingBagIcon className="pointer-events-none absolute -right-3 -bottom-3 h-20 w-20 text-white/10" />
              </div>
              {/* This month's sales */}
              <div
                onClick={() => navigate('/sales-report')}
                className="card cursor-pointer hover:shadow-md transition-all duration-150 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">This Month</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                    <ReceiptPercentIcon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3 leading-tight">{formatCurrency(data.salesSummary.monthTotal)}</p>
                <span className="mt-1 text-xs text-slate-400">
                  {data.salesSummary.monthCount} bill{data.salesSummary.monthCount !== 1 ? 's' : ''} this month
                </span>
              </div>
            </div>
            {/* Right: recent sales */}
            <div className="lg:col-span-2 card flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Recent Sales</h3>
                <button
                  onClick={() => navigate('/item-sales/new')}
                  className="text-xs font-medium text-trust-blue hover:underline"
                >
                  + New sale
                </button>
              </div>
              {data.salesSummary.recent?.length ? (
                <div className="-mr-1 pr-1 overflow-y-auto overflow-x-hidden flex-1">
                  {data.salesSummary.recent.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5 transition-colors"
                      onClick={() => navigate(`/item-sales/${s.id}/edit`)}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-trust-blue">
                        <ShoppingBagIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.party_name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          #{s.sale_number} · {formatDate(s.date)}
                          {s.item_count ? ` · ${s.item_count} item${s.item_count !== 1 ? 's' : ''}` : ''}
                          {data.restaurantEnabled && s.service_type ? ` · ${s.service_type === 'ac' ? 'A/C' : 'Non-A/C'}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 ml-2 shrink-0">
                        {formatCurrency(s.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <ShoppingBagIcon className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No sales yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restaurant decorations (shown when restaurant module is enabled) */}
      {data.restaurantEnabled && data.restaurantSummary && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FireIcon className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-900">Restaurant · Today</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* Left: A/C and Non-A/C stacked */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {/* A/C sales */}
              <div className="card flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">A/C Sales</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
                    <BuildingStorefrontIcon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3 leading-tight">{formatCurrency(data.restaurantSummary.acTotal)}</p>
                <span className="mt-1 text-xs text-slate-400">
                  {data.restaurantSummary.acCount} bill{data.restaurantSummary.acCount !== 1 ? 's' : ''} today
                </span>
              </div>
              {/* Non-A/C sales */}
              <div className="card flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Non-A/C Sales</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                    <FireIcon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3 leading-tight">{formatCurrency(data.restaurantSummary.nonAcTotal)}</p>
                <span className="mt-1 text-xs text-slate-400">
                  {data.restaurantSummary.nonAcCount} bill{data.restaurantSummary.nonAcCount !== 1 ? 's' : ''} today
                </span>
              </div>
            </div>
            {/* Right: top waiters this month */}
            <div className="lg:col-span-2 card flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <UserGroupIcon className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">Top Waiters (This Month)</h3>
              </div>
              {data.restaurantSummary.topWaiters?.length ? (
                <div className="space-y-2.5 flex-1">
                  {data.restaurantSummary.topWaiters.map((w, idx) => {
                    const max = data.restaurantSummary.topWaiters[0].total || 1;
                    const pct = (w.total / max) * 100;
                    const rankColors = ['bg-amber-400', 'bg-amber-300', 'bg-amber-200', 'bg-amber-200', 'bg-amber-200'];
                    return (
                      <div key={w.waiter_name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{idx + 1}</span>
                            <span className="text-slate-700 font-medium truncate">{w.waiter_name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">{w.count} bill{w.count !== 1 ? 's' : ''}</span>
                            <span className="font-bold text-amber-700">{formatCurrency(w.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-7">
                          <div className={`h-full rounded-full ${rankColors[idx] || 'bg-amber-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <UserGroupIcon className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No waiter sales this month</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        {/* <div className="card flex flex-col" style={{ height: '22rem' }}>
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
        </div> */}

        {/* Recent Transactions */}
        {/* <div className="card flex flex-col" style={{ height: '22rem' }}>
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
        </div> */}
      </div>
    </div>
  );
}
