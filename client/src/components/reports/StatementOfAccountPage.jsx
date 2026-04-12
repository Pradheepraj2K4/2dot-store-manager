import { useState, useEffect, useCallback, useMemo } from 'react';
import { ledgerApi, transactionApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

export default function StatementOfAccountPage() {
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchStatement = useCallback(async (ledgerId) => {
    try {
      setLoading(true);
      const [ledgerRes, txnRes] = await Promise.all([
        ledgerApi.getById(ledgerId),
        transactionApi.getByLedger(ledgerId),
      ]);
      setLedger(ledgerRes.data);
      setTransactions(txnRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLedger?.id) fetchStatement(selectedLedger.id);
    else { setLedger(null); setTransactions([]); }
  }, [selectedLedger, fetchStatement]);

  // Compute running balance
  const statementRows = useMemo(() => {
    if (!ledger) return [];
    let balance = 0;
    const isCustomer = ledger.behaviour === 'customer';

    // Transactions are from newest to oldest; reverse for running balance
    const sorted = [...transactions].reverse();
    return sorted.map((txn) => {
      const isPayment = txn.entry_type === 'payment';
      if (isCustomer) {
        balance = isPayment ? balance + txn.amount : balance - txn.amount;
      } else {
        balance = isPayment ? balance - txn.amount : balance + txn.amount;
      }
      return { ...txn, runningBalance: balance };
    });
  }, [ledger, transactions]);

  const handleExportExcel = () => {
    const columns = [
      { header: 'Date',       key: 'date',           width: 15 },
      { header: 'Ref #',      key: 'running_number',  width: 18 },
      { header: 'Type',       key: 'entry_type',      width: 12 },
      { header: 'Amount',     key: 'amount',          width: 15 },
      { header: 'Balance',    key: 'runningBalance',   width: 15 },
      { header: 'Remarks',   key: 'notes',           width: 25 },
    ];
    exportToExcel(statementRows, columns, `Statement_${ledger?.name || 'Account'}`);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Ref #', 'Type', 'Amount', 'Balance', 'Remarks'];
    const rows = statementRows.map((r) => [
      formatDate(r.date),
      r.running_number || '',
      r.entry_type === 'payment' ? 'Payment' : 'Receipt',
      formatCurrency(r.amount).replace('₹', 'Rs. '),
      formatCurrency(r.runningBalance).replace('₹', 'Rs. '),
      r.notes || '',
    ]);
    exportToPDF(`Statement of Account — ${ledger?.name || ''}`, headers, rows, `Statement_${ledger?.name || 'Account'}`);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <DocumentTextIcon className="h-6 w-6 text-trust-blue" />
          Statement of Account
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Select a ledger to view full account statement
        </p>
      </div>

      {/* Ledger Selector */}
      <div className="card">
        <label className="label mb-2">Select Ledger</label>
        <LedgerAutocomplete value={selectedLedger} onChange={setSelectedLedger} />
      </div>

      {loading && <LoadingSpinner className="py-12" size="lg" />}

      {!loading && ledger && (
        <>
          {/* Ledger Info Card */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{ledger.name}</h2>
                <p className="text-sm text-slate-500">
                  {ledger.type_name} ({ledger.behaviour}) · {ledger.phone || 'No phone'} · {ledger.place || 'No place'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Current Balance</p>
                <p className="text-sm font-bold text-debit-red">{formatCurrency(ledger.current_balance || 0)}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleExportExcel} className="btn-secondary gap-2 text-xs">
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />Excel
              </button>
              <button onClick={handleExportPDF} className="btn-secondary gap-2 text-xs">
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />PDF
              </button>
            </div>
          </div>

          {/* Statement Table */}
          {statementRows.length === 0 ? (
            <EmptyState
              icon={DocumentTextIcon}
              title="No transactions"
              description="This ledger has no recorded transactions"
            />
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">
                  Account Statement ({statementRows.length} entries)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-zebra">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Ref #</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Type</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Balance</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.map((row) => {
                      const isPayment = row.entry_type === 'payment';
                      return (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-4 py-2.5 text-slate-600">{formatDate(row.date)}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.running_number}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              isPayment ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                            }`}>
                              {isPayment ? 'Payment' : 'Receipt'}
                            </span>
                          </td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${isPayment ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                            {formatCurrency(row.runningBalance)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[200px] truncate">{row.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                        Closing Balance
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-debit-red">
                        {formatCurrency(ledger.current_balance || 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
