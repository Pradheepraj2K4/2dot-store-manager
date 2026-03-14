import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ledgerApi, transactionApi, interestApi, settingsApi } from '../../api';
import { formatCurrency, formatDate, formatDateTime, todayISO } from '../../utils/helpers';
import { buildInterestReceiptHtml, fetchLogoDataUrl } from '../../utils/interestReceipt';
import { buildTransactionReceiptHtml } from '../../utils/transactionReceipt';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  CalculatorIcon,
  TrashIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

/* ─── Transaction Entry Form ──────────────────────────────────────── */
function TransactionForm({ ledgerId, entryType, onCreated, currentBalance, behaviour }) {
  const [nextNum, setNextNum] = useState('');
  const [form, setForm] = useState({ amount: '', date: todayISO(), notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef(null);
  const dateRef   = useRef(null);
  const notesRef  = useRef(null);
  const submitRef = useRef(null);

  // Compute what balance would be after this entry
  const amt = parseFloat(form.amount);
  const wouldGoNegative = !isNaN(amt) && amt > 0 && (() => {
    let projected = currentBalance ?? 0;
    const beh = behaviour || 'customer';
    if (beh === 'customer') {
      projected = entryType === 'payment' ? projected + amt : projected - amt;
    } else {
      projected = entryType === 'payment' ? projected - amt : projected + amt;
    }
    return projected < 0;
  })();

  useEffect(() => {
    transactionApi.getNextRunningNumber(entryType).then((res) => setNextNum(res.data.runningNumber)).catch(() => {});
  }, [entryType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      setSubmitting(true);
      const created = await transactionApi.create({
        ledger_id: parseInt(ledgerId),
        entry_type: entryType,
        amount: parseFloat(form.amount),
        date: form.date,
        notes: form.notes.trim(),
      });
      toast.success(`${entryType === 'payment' ? 'Payment' : 'Receipt'} recorded`);
      setForm({ amount: '', date: todayISO(), notes: '' });
      // refresh next number
      transactionApi.getNextRunningNumber(entryType).then((r) => setNextNum(r.data.runningNumber)).catch(() => {});
      onCreated(created.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isPayment = entryType === 'payment';
  const colorAccent = isPayment ? 'red' : 'green';
  const Icon = isPayment ? ArrowUpCircleIcon : ArrowDownCircleIcon;

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-5 w-5 text-${colorAccent}-600`} />
        <h3 className={`text-sm font-semibold text-${colorAccent}-700`}>
          New {isPayment ? 'Payment' : 'Receipt'}
        </h3>
        {nextNum && <span className="ml-auto text-xs font-mono text-slate-400">{nextNum}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Amount *</label>
          <input
            ref={amountRef}
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dateRef.current?.focus(); } }}
            className={`input-field ${wouldGoNegative ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="0.00"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input
            ref={dateRef}
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); notesRef.current?.focus(); } }}
            className="input-field"
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <input
            ref={notesRef}
            type="text"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitRef.current?.focus(); } }}
            className="input-field"
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button
          ref={submitRef}
          type="submit"
          disabled={submitting}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            isPayment
              ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
              : 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
          }`}
        >
          {submitting ? 'Saving…' : `Record ${isPayment ? 'Payment' : 'Receipt'}`}
        </button>
      </div>
    </form>
  );
}

/* ─── Interest Section ────────────────────────────────────────────── */
function InterestSection({ ledgerId, ledger, onRefresh }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [payModal, setPayModal] = useState({ open: false, entry: null, paidDate: todayISO(), amount: '' });
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('a5');
  const [previewModal, setPreviewModal] = useState({ open: false, html: '' });
  const iframeRef = useRef(null);
  const pendingRefreshRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [profileRes, configRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      setReceiptFormat((configRes.data && configRes.data.format) || 'a5');
      if (profile.logo_path) {
        const dl = await fetchLogoDataUrl(profile.logo_path);
        setLogoDataUrl(dl);
      }
    })();
  }, []);

  const fetchInterest = useCallback(async () => {
    try {
      setLoading(true);
      const res = await interestApi.getByLedger(ledgerId);
      setEntries(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [ledgerId]);

  useEffect(() => { fetchInterest(); }, [fetchInterest]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await interestApi.generate({ ledgerId: parseInt(ledgerId) });
      toast.success('Interest generated');
      fetchInterest();
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const openPayModal = (entry) => {
    setPayModal({ open: true, entry, paidDate: todayISO(), amount: String(entry.amount) });
  };

  const handlePrint = (entry) => {
    const html = buildInterestReceiptHtml({ entry, ledgerName: ledger.name, store, logoDataUrl, format: receiptFormat });
    setPreviewModal({ open: true, html });
  };

  const closePreview = () => {
    setPreviewModal({ open: false, html: '' });
    if (pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      fetchInterest();
      onRefresh();
    }
  };

  const handlePay = async () => {
    const { entry, amount, paidDate } = payModal;
    const snapshot = { ...entry, amount: parseFloat(amount), paid_date: paidDate };
    try {
      setPayingId(entry.id);
      setPayModal((p) => ({ ...p, open: false }));
      await interestApi.markPaid(entry.id, paidDate, parseFloat(amount));
      toast.success('Interest marked as paid');
      handlePrint(snapshot);
      pendingRefreshRef.current = true;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPayingId(null);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      setDeletingId(entryId);
      await interestApi.deleteEntry(entryId);
      toast.success('Interest entry deleted');
      fetchInterest();
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const pending = entries.filter((e) => e.status === 'pending');
  const paid = entries.filter((e) => e.status === 'paid');
  const totalPending = pending.reduce((s, e) => s + e.amount, 0);
  const totalPaid = paid.reduce((s, e) => s + e.amount, 0);

  if (loading) return <LoadingSpinner size="sm" />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-700">Interest</h3>
          <span className="text-xs text-slate-400">
            {ledger.interest_rate}% {ledger.interest_scheme}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {totalPaid > 0 && (
            <span className="text-sm font-semibold text-green-700">
              Paid: {formatCurrency(totalPaid)}
            </span>
          )}
          {totalPending > 0 && (
            <span className="text-sm font-semibold text-amber-700">
              Pending: {formatCurrency(totalPending)}
            </span>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary text-xs"
          >
            {generating ? 'Generating…' : 'Generate Interest'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Pending ── */}
        <div>
          <p className="text-sm font-semibold text-amber-700 mb-2">Pending ({pending.length})</p>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">No pending interest</p>
          ) : (
            <div className="rounded-lg border border-amber-100 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-amber-50 text-amber-800 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium w-24">#</th>
                      <th className="px-3 py-2 text-left font-medium">Date / Period</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((e) => (
                      <tr key={e.id} className="border-t border-amber-50">
                        <td className="px-2 py-2">
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {e.interest_number || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {e.from_date === e.to_date
                            ? formatDate(e.from_date)
                            : `${formatDate(e.from_date)} – ${formatDate(e.to_date)}`}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-amber-700">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => openPayModal(e)}
                            disabled={payingId === e.id}
                            className="px-3 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            {payingId === e.id ? '…' : 'Pay'}
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

        {/* ── Paid ── */}
        <div>
          <p className="text-sm font-semibold text-green-700 mb-2">
            Paid ({paid.length})
            {totalPaid > 0 && <span className="ml-2 text-xs font-normal text-green-600"> · {formatCurrency(totalPaid)}</span>}
          </p>
          {paid.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">No paid interest yet</p>
          ) : (
            <div className="rounded-lg border border-green-100 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-green-50 text-green-800 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium w-24">#</th>
                      <th className="px-3 py-2 text-left font-medium">Date / Period</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Paid On</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.map((e) => (
                      <tr key={e.id} className="border-t border-green-50">
                        <td className="px-2 py-2">
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {e.interest_number || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {e.from_date === e.to_date
                            ? formatDate(e.from_date)
                            : `${formatDate(e.from_date)} – ${formatDate(e.to_date)}`}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {e.paid_date ? formatDate(e.paid_date) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handlePrint(e)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                              title="Print receipt"
                            >
                              <PrinterIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(e.id)}
                              disabled={deletingId === e.id}
                              className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pay Modal */}
      <Modal
        open={payModal.open}
        onClose={() => setPayModal((p) => ({ ...p, open: false }))}
        title="Mark Interest as Paid"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Amount Paid</label>
            <input
              type="number"
              value={payModal.amount}
              onChange={(e) => setPayModal((p) => ({ ...p, amount: e.target.value }))}
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">Paid On</label>
            <input
              type="date"
              value={payModal.paidDate}
              onChange={(e) => setPayModal((p) => ({ ...p, paidDate: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setPayModal((p) => ({ ...p, open: false }))}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={!payModal.amount || !payModal.paidDate}
              className="btn-primary"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        open={previewModal.open}
        onClose={closePreview}
        title="Receipt Preview"
        size="lg"
      >
        <div className="space-y-3">
          <iframe
            ref={iframeRef}
            srcDoc={previewModal.html}
            title="Receipt Preview"
            className="w-full border border-slate-200 rounded"
            style={{ minHeight: 300, maxHeight: 600, overflowX: 'hidden' }}
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc) {
                e.target.style.height = Math.min(doc.body.scrollHeight + 4, 600) + 'px';
              }
            }}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closePreview}
              className="btn-secondary"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => iframeRef.current?.contentWindow?.print()}
              className="btn-primary flex items-center gap-1.5"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────── */
export default function LedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ledger, setLedger] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closeLedgerModal, setCloseLedgerModal] = useState(false);
  const [reopenLedgerModal, setReopenLedgerModal] = useState(false);
  const [deleteTxnModal, setDeleteTxnModal] = useState({ open: false, txn: null });
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('a5');
  const [txnPreviewModal, setTxnPreviewModal] = useState({ open: false, html: '' });
  const txnIframeRef = useRef(null);
  const txnPendingRefreshRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ledgerRes, txnsRes, intRes] = await Promise.all([
        ledgerApi.getById(id),
        transactionApi.getByLedger(id),
        interestApi.isEnabled(),
      ]);
      setLedger(ledgerRes.data);
      setTransactions(txnsRes.data);
      setInterestEnabled(intRes.data.enabled);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (async () => {
      const [profileRes, configRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      setReceiptFormat((configRes.data && configRes.data.format) || 'a5');
      if (profile.logo_path) {
        const dl = await fetchLogoDataUrl(profile.logo_path);
        setLogoDataUrl(dl);
      }
    })();
  }, []);

  const openTxnPreview = (txn, needsRefresh = false) => {
    const html = buildTransactionReceiptHtml({
      txn,
      ledgerName: ledger?.name,
      store,
      logoDataUrl,
      format: receiptFormat,
    });
    if (needsRefresh) txnPendingRefreshRef.current = true;
    setTxnPreviewModal({ open: true, html });
  };

  const closeTxnPreview = () => {
    setTxnPreviewModal({ open: false, html: '' });
    if (txnPendingRefreshRef.current) {
      txnPendingRefreshRef.current = false;
      fetchData();
    }
  };

  const handleCloseLedger = async () => {
    try {
      await ledgerApi.update(id, { ...ledger, status: 'closed' });
      toast.success('Ledger closed');
      setCloseLedgerModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReopenLedger = async () => {
    try {
      await ledgerApi.update(id, { ...ledger, status: 'active' });
      toast.success('Ledger reopened');
      setReopenLedgerModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteTransaction = async () => {
    try {
      await transactionApi.delete(deleteTxnModal.txn.id);
      toast.success('Transaction deleted');
      setDeleteTxnModal({ open: false, txn: null });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (!ledger) return <p className="text-center text-slate-400 py-20">Ledger not found</p>;

  const isActive = ledger.status === 'active';
  const hasInterest = interestEnabled && ledger.interest_rate > 0;

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
            <p className="text-sm text-slate-500">
              {ledger.type_name} ({ledger.behaviour}) · {ledger.place || 'No location'} · {ledger.phone || 'No phone'}
            </p>
          </div>
        </div>
        {isActive ? (
          <button onClick={() => setCloseLedgerModal(true)} className="btn-secondary text-xs text-red-500">
            Close Ledger
          </button>
        ) : (
          <button onClick={() => setReopenLedgerModal(true)} className="btn-secondary text-xs text-green-600">
            Reopen Ledger
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-2 ${hasInterest ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Opening Balance</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(ledger.opening_balance || 0)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Current Balance</p>
          <p className="text-lg font-bold text-debit-red mt-1">{formatCurrency(ledger.current_balance || 0)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500">Status</p>
          <p className={`text-lg font-bold mt-1 ${isActive ? 'text-green-600' : 'text-slate-400'}`}>
            {isActive ? 'Active' : 'Closed'}
          </p>
        </div>
        {hasInterest && (
          <div className="card text-center border-amber-200 bg-white">
            <p className="text-xs font-medium text-amber-600">Interest Rate</p>
            <p className="text-lg font-bold text-amber-700 mt-1">
              {ledger.interest_rate}% <span className="text-xs font-normal">({ledger.interest_scheme})</span>
            </p>
          </div>
        )}
      </div>

      {/* Ledger Details */}
      <div className="card py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-slate-700 text-xs font-medium uppercase tracking-wide">Details</span>
          <span><span className="text-slate-700 text-xs">Type: </span><span className="font-medium">{ledger.type_name}</span></span>
          <span><span className="text-slate-700 text-xs">Behaviour: </span><span className="font-medium capitalize">{ledger.behaviour}</span></span>
          {ledger.phone && <span><span className="text-slate-700 text-xs">Phone: </span><span className="font-medium">{ledger.phone}</span></span>}
          {ledger.place && <span><span className="text-slate-700 text-xs">Place: </span><span className="font-medium">{ledger.place}</span></span>}
          {ledger.gst_no && <span><span className="text-slate-700 text-xs">GST: </span><span className="font-medium">{ledger.gst_no}</span></span>}
          {ledger.state_code && <span><span className="text-slate-400 text-xs">State: </span><span className="font-medium">{ledger.state_code}</span></span>}
          <span><span className="text-slate-700 text-xs">IGST: </span><span className="font-medium">{ledger.igst_status}</span></span>
          <span><span className="text-slate-700 text-xs">Created: </span><span className="font-medium">{formatDate(ledger.created_at)}</span></span>
          {ledger.address && <span><span className="text-slate-700 text-xs">Address: </span><span className="font-medium">{ledger.address}</span></span>}
          {ledger.notes && <span className="italic text-slate-500">{ledger.notes}</span>}
        </div>
      </div>

      {/* Transaction Entry Forms (only when active) */}
      {isActive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TransactionForm ledgerId={id} entryType="payment" onCreated={(txn) => { if (txn) openTxnPreview(txn, true); else fetchData(); }} currentBalance={ledger.current_balance} behaviour={ledger.behaviour} />
          <TransactionForm ledgerId={id} entryType="receipt" onCreated={(txn) => { if (txn) openTxnPreview(txn, true); else fetchData(); }} currentBalance={ledger.current_balance} behaviour={ledger.behaviour} />
        </div>
      )}

      {/* Interest Section */}
      {hasInterest && <InterestSection ledgerId={id} ledger={ledger} onRefresh={fetchData} />}

      {/* Transaction History */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={BanknotesIcon}
          title="No transactions"
          description="Record a payment or receipt to get started"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Transactions ({transactions.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Ref #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Notes</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Recorded</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isPayment = txn.entry_type === 'payment';
                  return (
                    <tr key={txn.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{txn.running_number}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isPayment ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {isPayment ? 'Payment' : 'Receipt'}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${isPayment ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(txn.date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[200px] truncate">{txn.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{formatDateTime(txn.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openTxnPreview(txn)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Print receipt"
                          >
                            <PrinterIcon className="w-4 h-4" />
                          </button>
                          {isActive && (
                            <button
                              onClick={() => setDeleteTxnModal({ open: true, txn })}
                              className="text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete transaction"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Receipt Preview */}
      <Modal
        open={txnPreviewModal.open}
        onClose={closeTxnPreview}
        title="Receipt Preview"
        size="lg"
      >
        <div className="space-y-3">
          <iframe
            ref={txnIframeRef}
            srcDoc={txnPreviewModal.html}
            title="Receipt Preview"
            className="w-full border border-slate-200 rounded"
            style={{ minHeight: 300, maxHeight: 600, overflowX: 'hidden' }}
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc) e.target.style.height = Math.min(doc.body.scrollHeight + 4, 600) + 'px';
            }}
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeTxnPreview} className="btn-secondary">Close</button>
            <button
              type="button"
              onClick={() => txnIframeRef.current?.contentWindow?.print()}
              className="btn-primary flex items-center gap-1.5"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </Modal>

      {/* Close Ledger Confirmation */}
      <Modal open={closeLedgerModal} onClose={() => setCloseLedgerModal(false)} title="Close Ledger" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to close <strong>{ledger.name}</strong>? No further transactions
          can be recorded after closing.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setCloseLedgerModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleCloseLedger} className="btn-danger">Close Ledger</button>
        </div>
      </Modal>

      {/* Reopen Ledger Confirmation */}
      <Modal open={reopenLedgerModal} onClose={() => setReopenLedgerModal(false)} title="Reopen Ledger" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Reopen <strong>{ledger.name}</strong>? Transactions can be recorded again.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setReopenLedgerModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleReopenLedger} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors">Reopen Ledger</button>
        </div>
      </Modal>

      {/* Delete Transaction Confirmation */}
      <Modal open={deleteTxnModal.open} onClose={() => setDeleteTxnModal({ open: false, txn: null })} title="Delete Transaction" size="sm">
        {deleteTxnModal.txn && (
          <>
            <p className="text-sm text-slate-600 mb-6">
              Delete <strong>{deleteTxnModal.txn.running_number}</strong> ({deleteTxnModal.txn.entry_type === 'payment' ? 'Payment' : 'Receipt'} of{' '}
              <strong>{formatCurrency(deleteTxnModal.txn.amount)}</strong>)? This will reverse the balance effect.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTxnModal({ open: false, txn: null })} className="btn-secondary">Cancel</button>
              <button onClick={handleDeleteTransaction} className="btn-danger">Delete</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
