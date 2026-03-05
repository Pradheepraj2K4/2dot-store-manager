import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ledgerApi, accountApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  EyeIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

export default function LedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ledger, setLedger] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ledgerRes, accountsRes] = await Promise.all([
        ledgerApi.getById(id),
        accountApi.getByLedger(id),
      ]);
      setLedger(ledgerRes.data);
      setAccounts(accountsRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (!ledger) return <p className="text-center text-slate-400 py-20">Ledger not found</p>;

  const totalOutstanding = accounts.reduce((sum, a) => sum + (a.outstanding || a.current_balance), 0);
  const totalPendingInterest = accounts.reduce((sum, a) => sum + (a.pending_interest || 0), 0);
  const activeAccounts = accounts.filter(a => a.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ledgers')}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">{ledger.name}</h1>
            <p className="text-sm text-slate-500 capitalize">
              {ledger.type} · {ledger.place || 'No location'} · {ledger.phone || 'No phone'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/account-creation')}
          className="btn-primary gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          New Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Total Accounts</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{accounts.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Active</p>
          <p className="text-lg font-bold text-trust-blue mt-1">{activeAccounts.length}</p>
        </div>
        <div className="card text-center border-amber-200 bg-amber-50/30">
          <p className="text-xs font-medium text-amber-600">Pending Interest</p>
          <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(totalPendingInterest)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Total Outstanding</p>
          <p className="text-lg font-bold text-debit-red mt-1">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      {/* Ledger Info */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Ledger Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs">Type</p>
            <p className="font-medium capitalize">{ledger.type}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Phone</p>
            <p className="font-medium">{ledger.phone || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Place</p>
            <p className="font-medium">{ledger.place || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">GST</p>
            <p className="font-medium">{ledger.gst_no || '—'}</p>
          </div>
        </div>
        {ledger.address && (
          <p className="text-sm text-slate-500 mt-3 pt-3 border-t border-slate-100">{ledger.address}</p>
        )}
      </div>

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={BanknotesIcon}
          title="No accounts"
          description="Create the first account for this ledger"
          action={
            <button onClick={() => navigate('/account-creation')} className="btn-primary gap-2">
              <PlusIcon className="h-4 w-4" />
              New Account
            </button>
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Accounts ({accounts.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Account #</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Principal</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Current Balance</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Pending Interest</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Outstanding</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Created</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct) => (
                  <tr key={acct.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-700">#{acct.id}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(acct.principal)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-trust-blue">{formatCurrency(acct.current_balance)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-amber-700">
                      {formatCurrency(acct.pending_interest || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-debit-red">
                      {formatCurrency(acct.outstanding || acct.current_balance)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        acct.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {acct.status === 'active' ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(acct.created_at)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => navigate(`/account/${acct.id}`)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                        title="View Account"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
