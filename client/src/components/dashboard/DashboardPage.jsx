import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import StatCard from '../ui/StatCard';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  UserGroupIcon,
  TruckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ArrowPathIcon,
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

  const customerCount = data.partyCounts.find((p) => p.type === 'customer')?.count || 0;
  const supplierCount = data.partyCounts.find((p) => p.type === 'supplier')?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of your accounts</p>
        </div>
        <button onClick={fetchDashboard} className="btn-secondary gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Customers"
          value={customerCount}
          icon={UserGroupIcon}
          color="blue"
        />
        <StatCard
          title="Suppliers"
          value={supplierCount}
          icon={TruckIcon}
          color="slate"
        />
        <StatCard
          title="Total Receivable"
          value={formatCurrency(data.totalReceivable)}
          subtitle="From customers — click to view"
          icon={ArrowTrendingUpIcon}
          color="green"
          onClick={() => navigate('/reports?tab=outstanding&type=customer')}
        />
        <StatCard
          title="Total Payable"
          value={formatCurrency(data.totalPayable)}
          subtitle="To suppliers — click to view"
          icon={ArrowTrendingDownIcon}
          color="red"
          onClick={() => navigate('/reports?tab=outstanding&type=supplier')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Outstanding */}
        <div className="card flex flex-col" style={{ height: '22rem' }}>
          <h2 className="text-base font-semibold text-slate-900 mb-3 shrink-0">Top Outstanding Balances</h2>
          {data.topOutstanding.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No outstanding balances</p>
          ) : (
            <div className="overflow-y-auto flex-1 -mr-1 pr-1">
              {data.topOutstanding.map((party) => (
                <div key={party.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{party.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{party.type}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ml-3 shrink-0 ${
                      party.current_balance >= 0 ? 'text-credit-green' : 'text-debit-red'
                    }`}
                  >
                    {formatCurrency(party.current_balance)}
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
              {data.recentTransactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{txn.party_name}</p>
                    <p className="text-xs text-slate-400">{formatDate(txn.date)} · {txn.receipt_number}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={txn.type === 'credit' ? 'badge-credit' : 'badge-debit'}>
                      {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Transactions"
          value={data.txnSummary.total_transactions}
          icon={BanknotesIcon}
          color="slate"
        />
        <StatCard
          title="Total Credits"
          value={formatCurrency(data.txnSummary.total_credits)}
          subtitle="Click to view credits"
          icon={ArrowTrendingUpIcon}
          color="green"
          onClick={() => navigate('/payments?type=credit')}
        />
        <StatCard
          title="Total Debits"
          value={formatCurrency(data.txnSummary.total_debits)}
          subtitle="Click to view debits"
          icon={ArrowTrendingDownIcon}
          color="red"
          onClick={() => navigate('/payments?type=debit')}
        />
      </div>
    </div>
  );
}
