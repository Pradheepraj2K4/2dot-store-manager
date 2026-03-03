import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { transactionApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

export default function PartyLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLedger();
  }, [id]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await transactionApi.getByParty(id);
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!data) return;
    const columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Receipt #', key: 'receipt_number', width: 18 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Balance After', key: 'balance_after', width: 15 },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Notes', key: 'notes', width: 25 },
    ];
    exportToExcel(data.transactions, columns, `Ledger_${data.party.name}`);
  };

  const handleExportPDF = () => {
    if (!data) return;
    const headers = ['Date', 'Receipt #', 'Type', 'Amount', 'Balance', 'Reference'];
    const rows = data.transactions.map((t) => [
      formatDate(t.date),
      t.receipt_number || '',
      t.type.toUpperCase(),
      formatCurrency(t.amount),
      formatCurrency(t.balance_after),
      t.reference || '',
    ]);
    exportToPDF(
      `Statement of Account — ${data.party.name}`,
      headers,
      rows,
      `Ledger_${data.party.name}`
    );
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (!data) return null;

  const { party, transactions, balance } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">{party.name}</h1>
            <p className="text-sm text-slate-500 capitalize">
              {party.type} · {party.place || 'No location'} · {party.phone || 'No phone'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-secondary gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Excel
          </button>
          <button onClick={handleExportPDF} className="btn-secondary gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Opening</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(balance.opening_balance)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Total Credits</p>
          <p className="text-lg font-bold text-credit-green mt-1">{formatCurrency(balance.total_credit)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Total Debits</p>
          <p className="text-lg font-bold text-debit-red mt-1">{formatCurrency(balance.total_debit)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Current Balance</p>
          <p className={`text-lg font-bold mt-1 ${balance.current_balance >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
            {formatCurrency(balance.current_balance)}
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No transactions recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Receipt #</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Balance</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Reference</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-blue-50 border-b border-slate-200">
                  <td className="px-4 py-2.5 text-slate-600">—</td>
                  <td className="px-4 py-2.5 text-slate-600">—</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-trust-blue">
                      Opening
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {formatCurrency(party.opening_balance)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {formatCurrency(party.opening_balance)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 italic">Opening Balance</td>
                </tr>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(txn.date)}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{txn.receipt_number || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={txn.type === 'credit' ? 'badge-credit' : 'badge-debit'}>
                        {txn.type.toUpperCase()}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${txn.type === 'credit' ? 'text-credit-green' : 'text-debit-red'}`}>
                      {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${txn.balance_after >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                      {formatCurrency(txn.balance_after)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 truncate max-w-[200px]">{txn.reference || txn.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
