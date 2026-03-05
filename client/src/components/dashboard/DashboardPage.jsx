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
  ClipboardDocumentListIcon,
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

  const counts = data.ledgerCounts || [];
  const customerCount = counts.find((p) => p.type === 'customer')?.count || 0;
  const supplierCount = counts.find((p) => p.type === 'supplier')?.count || 0;

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

      {/* Account summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Accounts"
          value={data.totalAccounts}
          icon={ClipboardDocumentListIcon}
          color="slate"
        />
        <StatCard
          title="Active Accounts"
          value={data.activeAccounts}
          icon={BanknotesIcon}
          color="blue"
        />
        <StatCard
          title="Pending Interest"
          value="View All"
          subtitle="Accounts with pending interest"
          icon={ArrowTrendingDownIcon}
          color="red"
          onClick={() => navigate('/pending-interest')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Outstanding */}
        <div className="card flex flex-col" style={{ height: '22rem' }}>
          <h2 className="text-base font-semibold text-slate-900 mb-3 shrink-0">Top Outstanding Accounts</h2>
          {data.topOutstanding.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No outstanding balances</p>
          ) : (
            <div className="overflow-y-auto flex-1 -mr-1 pr-1">
              {data.topOutstanding.map((acct) => (
                <div
                  key={acct.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors rounded px-1"
                  onClick={() => navigate(`/account/${acct.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{acct.ledger_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{acct.ledger_type} · Account #{acct.id}</p>
                  </div>
                  <span className="text-sm font-semibold ml-3 shrink-0 text-debit-red">
                    {formatCurrency(acct.outstanding)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="card flex flex-col" style={{ height: '22rem' }}>
          <h2 className="text-base font-semibold text-slate-900 mb-3 shrink-0">Recent Payments</h2>
          {data.recentPayments.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No payments yet</p>
          ) : (
            <div className="overflow-y-auto flex-1 -mr-1 pr-1">
              {data.recentPayments.map((pmt) => (
                <div key={pmt.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{pmt.ledger_name}</p>
                    <p className="text-xs text-slate-400">{formatDate(pmt.date)} · {pmt.receipt_number}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      pmt.type === 'principal'
                        ? 'bg-trust-blue/10 text-trust-blue'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {formatCurrency(pmt.amount)}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{pmt.type}</p>
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
