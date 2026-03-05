import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { accountApi, paymentApi, interestApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
} from '@heroicons/react/24/outline';

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [payments, setPayments] = useState([]);
  const [interestEntries, setInterestEntries] = useState([]);
  const [pendingInterest, setPendingInterest] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pay interest modal
  const [payInterestModal, setPayInterestModal] = useState({ open: false, entry: null });
  const [payInterestDate, setPayInterestDate] = useState('');

  // Pay principal modal
  const [payPrincipalModal, setPayPrincipalModal] = useState(false);
  const [principalForm, setPrincipalForm] = useState({ amount: '', date: '', reference: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [acctRes, paymentsRes, interestRes, pendingRes] = await Promise.all([
        accountApi.getById(id),
        paymentApi.getByAccount(id),
        interestApi.getByAccount(id).catch(() => ({ data: [] })),
        interestApi.getPendingByAccount(id).catch(() => ({ data: [] })),
      ]);
      setAccount(acctRes.data);
      setPayments(paymentsRes.data);
      setInterestEntries(interestRes.data);
      setPendingInterest(pendingRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePayInterestOpen = (entry) => {
    setPayInterestDate(new Date().toISOString().split('T')[0]);
    setPayInterestModal({ open: true, entry });
  };

  const handlePayInterestSubmit = async () => {
    if (!payInterestModal.entry) return;
    try {
      await paymentApi.payInterest({
        account_id: parseInt(id),
        interest_entry_id: payInterestModal.entry.id,
        date: payInterestDate,
      });
      toast.success('Interest payment recorded');
      setPayInterestModal({ open: false, entry: null });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePayPrincipalOpen = () => {
    setPrincipalForm({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      reference: '',
      notes: '',
    });
    setPayPrincipalModal(true);
  };

  const handlePayPrincipalSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(principalForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await paymentApi.payPrincipal({
        account_id: parseInt(id),
        amount: amt,
        date: principalForm.date,
        reference: principalForm.reference,
        notes: principalForm.notes,
      });
      toast.success('Principal payment recorded');
      setPayPrincipalModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (!account) return <p className="text-center text-slate-400 py-20">Account not found</p>;

  const totalPendingInterest = pendingInterest.reduce((sum, e) => sum + e.amount, 0);
  const outstanding = account.current_balance + totalPendingInterest;
  const hasPendingInterest = pendingInterest.length > 0;
  const totalPrincipalPaid = payments.filter(p => p.type === 'principal').reduce((sum, p) => sum + p.amount, 0);
  const totalInterestPaid = payments.filter(p => p.type === 'interest').reduce((sum, p) => sum + p.amount, 0);

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
            <h1 className="page-title">{account.ledger_name}</h1>
            <p className="text-sm text-slate-500 capitalize">
              {account.ledger_type} · Account #{account.id}
              {account.status === 'closed' && (
                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                  Closed
                </span>
              )}
            </p>
          </div>
        </div>
        {account.status === 'active' && (
          <button
            onClick={handlePayPrincipalOpen}
            disabled={hasPendingInterest}
            className={`btn-primary gap-2 ${hasPendingInterest ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={hasPendingInterest ? 'Pay all pending interest first' : 'Make a principal payment'}
          >
            <CurrencyRupeeIcon className="h-4 w-4" />
            Pay Principal
          </button>
        )}
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Principal</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(account.principal)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Current Balance</p>
          <p className="text-lg font-bold text-trust-blue mt-1">{formatCurrency(account.current_balance)}</p>
        </div>
        <div className="card text-center border-amber-200 bg-amber-50/30">
          <p className="text-xs font-medium text-amber-600">Pending Interest</p>
          <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(totalPendingInterest)}</p>
          <p className="text-[10px] text-amber-500">{pendingInterest.length} entries</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Outstanding</p>
          <p className="text-lg font-bold text-debit-red mt-1">{formatCurrency(outstanding)}</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs">Interest Rate</p>
            <p className="font-medium">{account.interest_rate > 0 ? `${account.interest_rate}% p.a.` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Interest Scheme</p>
            <p className="font-medium">{account.interest_scheme === 'NONE' ? 'No Interest' : account.interest_scheme}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Principal Paid</p>
            <p className="font-medium text-credit-green">{formatCurrency(totalPrincipalPaid)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Interest Paid</p>
            <p className="font-medium text-credit-green">{formatCurrency(totalInterestPaid)}</p>
          </div>
        </div>
        {account.notes && (
          <p className="text-sm text-slate-500 mt-3 pt-3 border-t border-slate-100">{account.notes}</p>
        )}
      </div>

      {/* Pending Interest Warning */}
      {hasPendingInterest && account.status === 'active' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium mb-1">
            {pendingInterest.length} pending interest {pendingInterest.length === 1 ? 'entry' : 'entries'} — pay all before making a principal payment
          </p>
        </div>
      )}

      {/* Pending Interest Entries */}
      {pendingInterest.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-amber-50">
            <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Pending Interest ({pendingInterest.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Period</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Days</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Rate</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Principal</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Interest</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingInterest.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDate(entry.from_date)}
                      {entry.from_date !== entry.to_date && ` — ${formatDate(entry.to_date)}`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{entry.days}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{entry.rate}%</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(entry.principal_at_time)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-700">{formatCurrency(entry.amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handlePayInterestOpen(entry)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Pay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4" />
            Payment History ({payments.length})
          </h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No payments recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Receipt #</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={`border-b border-slate-100 ${p.type === 'interest' ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(p.date)}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{p.receipt_number || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.type === 'principal'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.type === 'principal' ? 'Principal' : 'Interest'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-credit-green">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 truncate max-w-[200px]">
                      {p.reference || p.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All Interest Entries */}
      {interestEntries.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">All Interest Entries ({interestEntries.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Period</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Days</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {interestEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDate(entry.from_date)}
                      {entry.from_date !== entry.to_date && ` — ${formatDate(entry.to_date)}`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{entry.days}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(entry.amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.status === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {entry.status === 'pending' ? 'Pending' : 'Paid'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {entry.paid_date ? formatDate(entry.paid_date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Interest Modal */}
      <Modal
        open={payInterestModal.open}
        onClose={() => setPayInterestModal({ open: false, entry: null })}
        title="Pay Interest"
        size="sm"
      >
        {payInterestModal.entry && (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-slate-500">Period:</span> {formatDate(payInterestModal.entry.from_date)}
                {payInterestModal.entry.from_date !== payInterestModal.entry.to_date && ` — ${formatDate(payInterestModal.entry.to_date)}`}</p>
              <p><span className="text-slate-500">Days:</span> {payInterestModal.entry.days}</p>
              <p><span className="text-slate-500">Rate:</span> {payInterestModal.entry.rate}%</p>
              <p><span className="text-slate-500">Principal at time:</span> {formatCurrency(payInterestModal.entry.principal_at_time)}</p>
              <p className="text-base font-bold text-amber-800">
                Amount: {formatCurrency(payInterestModal.entry.amount)}
              </p>
            </div>
            <div>
              <label className="label">Payment Entry Date</label>
              <input
                type="date"
                value={payInterestDate}
                onChange={(e) => setPayInterestDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPayInterestModal({ open: false, entry: null })} className="btn-secondary">Cancel</button>
              <button onClick={handlePayInterestSubmit} className="btn-primary">Confirm Payment</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pay Principal Modal */}
      <Modal
        open={payPrincipalModal}
        onClose={() => setPayPrincipalModal(false)}
        title="Pay Principal"
        size="sm"
      >
        <form onSubmit={handlePayPrincipalSubmit} className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p><span className="text-slate-500">Current Balance:</span> <strong>{formatCurrency(account?.current_balance || 0)}</strong></p>
          </div>
          <div>
            <label className="label">Amount *</label>
            <input
              type="number"
              value={principalForm.amount}
              onChange={(e) => setPrincipalForm({ ...principalForm, amount: e.target.value })}
              className="input-field"
              placeholder="Enter amount"
              min="0"
              max={account?.current_balance || 0}
              step="0.01"
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={principalForm.date}
              onChange={(e) => setPrincipalForm({ ...principalForm, date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Reference</label>
            <input
              type="text"
              value={principalForm.reference}
              onChange={(e) => setPrincipalForm({ ...principalForm, reference: e.target.value })}
              className="input-field"
              placeholder="Check #, UPI ref, etc."
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              value={principalForm.notes}
              onChange={(e) => setPrincipalForm({ ...principalForm, notes: e.target.value })}
              className="input-field resize-none"
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPayPrincipalModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Confirm Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
