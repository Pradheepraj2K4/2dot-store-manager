import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ledgerApi, transactionApi, interestApi, settingsApi, ledgerTypeApi, interestSchemeApi } from '../../api';
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
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

/* ─── Validation helpers (shared by edit modal) ───────────────────── */
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PHONE_REGEX = /^\d{10}$/;
const STATE_REGEX = /^\d{2}$/;

function validateLedgerForm(form) {
  const errors = {};
  if (!form.ledger_type_id) errors.ledger_type_id = 'Please select a ledger type.';
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  if (form.phone && !PHONE_REGEX.test(form.phone.replace(/\s/g, ''))) errors.phone = 'Enter a valid 10-digit number.';
  if (form.gst_no && !GST_REGEX.test(form.gst_no.trim().toUpperCase())) errors.gst_no = 'Invalid GST number.';
  if (form.state_code && !STATE_REGEX.test(form.state_code.trim())) errors.state_code = 'State code must be 2 digits.';
  if (form.gst_no && !form.state_code) errors.state_code = 'Required when GST is set.';
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

/* ─── Bulk-pay distribution helper ───────────────────────────────── */
function computeBulkDistribution(pending, rawAmount) {
  let remaining = Math.round((parseFloat(rawAmount) || 0) * 100) / 100;
  return pending.map((entry) => {
    if (remaining <= 0) return { ...entry, willPay: 0, leftover: entry.amount, rowStatus: 'untouched' };
    if (remaining >= entry.amount) {
      const willPay = entry.amount;
      remaining = Math.round((remaining - entry.amount) * 100) / 100;
      return { ...entry, willPay, leftover: 0, rowStatus: 'full' };
    }
    const willPay  = Math.round(remaining * 100) / 100;
    const leftover = Math.round((entry.amount - willPay) * 100) / 100;
    remaining = 0;
    return { ...entry, willPay, leftover, rowStatus: 'partial' };
  });
}

/* ─── Interest Section ────────────────────────────────────────────── */
function InterestSection({ ledgerId, ledger, onRefresh }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [payModal, setPayModal] = useState({ open: false, entry: null, paidDate: todayISO(), amount: '', applyDiscount: false, discountAmount: '' });
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('a5');
  const [previewModal, setPreviewModal] = useState({ open: false, html: '' });
  const [printReceiptsEnabled, setPrintReceiptsEnabled] = useState(false);
  const iframeRef = useRef(null);
  const pendingRefreshRef = useRef(false);

  // Bulk pay
  const [bulkPayModal, setBulkPayModal] = useState({ open: false, amount: '', paidDate: todayISO() });
  const [bulkPaying, setBulkPaying] = useState(false);

  useEffect(() => {
    (async () => {
      const [profileRes, configRes, printRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
        settingsApi.get('print_receipts_interest_enabled').catch(() => ({ data: { value: 'false' } })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      setReceiptFormat((configRes.data && configRes.data.format) || 'a5');
      const pv = printRes.data?.value;
      setPrintReceiptsEnabled(pv === true || pv === 'true');
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
    setPayModal({ open: true, entry, paidDate: todayISO(), amount: String(entry.amount), applyDiscount: false, discountAmount: '' });
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
    const { entry, amount, paidDate, applyDiscount, discountAmount } = payModal;
    const discount = applyDiscount ? parseFloat(discountAmount || 0) : 0;
    const finalAmount = Math.max(0, parseFloat(amount) - discount);
    const snapshot = { ...entry, amount: finalAmount, paid_date: paidDate };
    try {
      setPayingId(entry.id);
      setPayModal((p) => ({ ...p, open: false }));
      await interestApi.markPaid(entry.id, paidDate, finalAmount);
      toast.success(discount > 0 ? `Interest paid with discount of ${formatCurrency(discount)}` : 'Interest marked as paid');
      if (printReceiptsEnabled) {
        handlePrint(snapshot);
        pendingRefreshRef.current = true;
      } else {
        fetchInterest();
        onRefresh();
      }
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

  const handleBulkPay = async () => {
    const amt = parseFloat(bulkPayModal.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!bulkPayModal.paidDate) { toast.error('Select a paid date'); return; }
    try {
      setBulkPaying(true);
      const res = await interestApi.bulkPay({
        ledgerId: parseInt(ledgerId),
        amount: amt,
        paidDate: bulkPayModal.paidDate,
      });
      const { paid_count } = res.data;
      toast.success(`${paid_count} interest entr${paid_count === 1 ? 'y' : 'ies'} settled`);
      setBulkPayModal({ open: false, amount: '', paidDate: todayISO() });
      fetchInterest();
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBulkPaying(false);
    }
  };

  const pending = entries.filter((e) => e.status === 'pending');
  const paid = [...entries.filter((e) => e.status === 'paid')].sort((a, b) => {
    if (b.paid_date !== a.paid_date) return b.paid_date > a.paid_date ? 1 : -1;
    return b.id - a.id;
  });
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
          {/* <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary text-xs"
          >
            {generating ? 'Generating…' : 'Generate Interest'}
          </button> */}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Pending ── */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-amber-700">Pending ({pending.length})</p>
            {pending.length > 0 && (
              <button
                onClick={() => setBulkPayModal({ open: true, amount: String(totalPending), paidDate: todayISO() })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 border-2 text-amber-800 hover:bg-amber-200 transition-colors"
              >
                <BanknotesIcon className="h-3.5 w-3.5" />
                Bulk Pay
              </button>
            )}
          </div>
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
                          {e.id === pending[0]?.id ? (
                            <button
                              onClick={() => openPayModal(e)}
                              disabled={payingId === e.id}
                              className="px-3 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                            >
                              {payingId === e.id ? '…' : 'Pay'}
                            </button>
                          ) : (
                            <span className="px-3 py-1 rounded text-xs text-slate-300 cursor-not-allowed" title="Pay earlier entries first">
                              Locked
                            </span>
                          )}
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
                            {printReceiptsEnabled && (
                              <button
                                onClick={() => handlePrint(e)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                title="Print receipt"
                              >
                                <PrinterIcon className="h-4 w-4" />
                              </button>
                            )}
                            {e.id === paid[0]?.id ? (
                              <button
                                onClick={() => handleDeleteEntry(e.id)}
                                disabled={deletingId === e.id}
                                className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Revert to pending"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="p-1 text-slate-200 cursor-not-allowed" title="Only the latest paid entry can be reverted">
                                <TrashIcon className="h-4 w-4" />
                              </span>
                            )}
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

      {/* Bulk Pay Modal */}
      <Modal
        open={bulkPayModal.open}
        onClose={() => setBulkPayModal((p) => ({ ...p, open: false }))}
        title="Bulk Interest Payment"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Amount to Pay</label>
              <input
                type="number"
                value={bulkPayModal.amount}
                onChange={(e) => setBulkPayModal((p) => ({ ...p, amount: e.target.value }))}
                className="input-field"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Total pending: <span className="font-medium text-amber-700">{formatCurrency(totalPending)}</span>
              </p>
            </div>
            <div>
              <label className="label">Paid On</label>
              <input
                type="date"
                value={bulkPayModal.paidDate}
                onChange={(e) => setBulkPayModal((p) => ({ ...p, paidDate: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>

          {pending.length > 0 && parseFloat(bulkPayModal.amount) > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Distribution Preview</p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Period</th>
                        <th className="px-3 py-2 text-right font-medium">Due</th>
                        <th className="px-3 py-2 text-right font-medium">Will Pay</th>
                        <th className="px-3 py-2 text-right font-medium">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computeBulkDistribution(pending, bulkPayModal.amount).map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t border-slate-100 ${
                            row.rowStatus === 'untouched' ? 'opacity-40' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-600">
                            {row.from_date === row.to_date
                              ? formatDate(row.from_date)
                              : `${formatDate(row.from_date)} – ${formatDate(row.to_date)}`}
                            {row.rowStatus === 'partial' && (
                              <span className="ml-1.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">partial</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-amber-700">{formatCurrency(row.amount)}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {row.willPay > 0 ? (
                              <span className={row.rowStatus === 'partial' ? 'text-orange-600' : 'text-green-600'}>
                                {formatCurrency(row.willPay)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.leftover > 0 ? (
                              <span className="text-red-500 font-medium">{formatCurrency(row.leftover)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {parseFloat(bulkPayModal.amount) > totalPending && (
                <p className="text-xs text-amber-600 mt-1.5">
                  Amount exceeds total pending ({formatCurrency(totalPending)}). Only the pending amount will be settled.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setBulkPayModal((p) => ({ ...p, open: false }))}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkPay}
              disabled={
                bulkPaying ||
                !bulkPayModal.amount ||
                parseFloat(bulkPayModal.amount) <= 0 ||
                !bulkPayModal.paidDate
              }
              className="btn-primary"
            >
              {bulkPaying ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Pay Modal */}
      <Modal
        open={payModal.open}
        onClose={() => setPayModal((p) => ({ ...p, open: false }))}
        title="Mark Interest as Paid"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Amount Due</label>
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

          {/* Discount */}
          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={payModal.applyDiscount}
                onChange={(e) => setPayModal((p) => ({ ...p, applyDiscount: e.target.checked, discountAmount: '' }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm font-medium text-slate-700">Apply Discount</span>
            </label>
            {payModal.applyDiscount && (
              <div>
                <label className="label">Discount Amount</label>
                <input
                  type="number"
                  value={payModal.discountAmount}
                  onChange={(e) => setPayModal((p) => ({ ...p, discountAmount: e.target.value }))}
                  className="input-field"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  autoFocus
                />
                {payModal.discountAmount && parseFloat(payModal.discountAmount) > 0 && (
                  <p className="text-xs mt-1.5 text-green-700 font-medium">
                    Net payable: {formatCurrency(Math.max(0, parseFloat(payModal.amount || 0) - parseFloat(payModal.discountAmount || 0)))}
                  </p>
                )}
              </div>
            )}
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
              disabled={!payModal.amount || !payModal.paidDate || (payModal.applyDiscount && !payModal.discountAmount)}
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
  const [printReceiptsPaymentEnabled, setPrintReceiptsPaymentEnabled] = useState(false);
  const txnIframeRef = useRef(null);
  const txnPendingRefreshRef = useRef(false);

  // Edit ledger modal
  const [ledgerTypes, setLedgerTypes] = useState([]);
  const [interestSchemes, setInterestSchemes] = useState([]);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [editSaving, setEditSaving] = useState(false);

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
    ledgerTypeApi.getAll().then((res) => setLedgerTypes(res.data)).catch(() => { });
    interestSchemeApi.getAll().then((res) => setInterestSchemes(res.data || [])).catch(() => { });
  }, []);

  useEffect(() => {
    (async () => {
      const [profileRes, configRes, printRes] = await Promise.all([
        settingsApi.getStoreProfile().catch(() => ({ data: {} })),
        settingsApi.getReceiptConfig().catch(() => ({ data: {} })),
        settingsApi.get('print_receipts_payment_enabled').catch(() => ({ data: { value: 'false' } })),
      ]);
      const profile = profileRes.data || {};
      setStore(profile);
      setReceiptFormat((configRes.data && configRes.data.format) || 'a5');
      const pv = printRes.data?.value;
      setPrintReceiptsPaymentEnabled(pv === true || pv === 'true');
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

  const openEditModal = () => {
    setEditForm({
      ledger_type_id: ledger.ledger_type_id || '',
      name: ledger.name || '',
      phone: ledger.phone || '',
      place: ledger.place || '',
      address: ledger.address || '',
      gst_no: ledger.gst_no || '',
      state_code: ledger.state_code || '',
      igst_status: ledger.igst_status || 'NO',
      ledger_date: ledger.ledger_date || '',
      interest_rate: ledger.interest_rate != null ? String(ledger.interest_rate) : '',
      interest_scheme_id: ledger.interest_scheme_id != null ? String(ledger.interest_scheme_id) : '',
      notes: ledger.notes || '',
    });
    setEditErrors({});
    setEditTouched({});
    setEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    const next = { ...editForm, [name]: value };
    setEditForm(next);
    if (editTouched[name]) setEditErrors(validateLedgerForm(next));
  };

  const handleEditBlur = (e) => {
    const { name } = e.target;
    setEditTouched((p) => ({ ...p, [name]: true }));
    setEditErrors(validateLedgerForm(editForm));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = validateLedgerForm(editForm);
    setEditErrors(errs);
    setEditTouched(Object.fromEntries(Object.keys(editForm).map((k) => [k, true])));
    if (Object.keys(errs).length > 0) return;
    try {
      setEditSaving(true);
      await ledgerApi.update(id, {
        ...editForm,
        ledger_type_id: parseInt(editForm.ledger_type_id),
        name: editForm.name.trim(),
        gst_no: editForm.gst_no.trim().toUpperCase(),
        state_code: editForm.state_code.trim(),
        interest_rate: parseFloat(editForm.interest_rate) || 0,
        interest_scheme_id: editForm.interest_scheme_id ? parseInt(editForm.interest_scheme_id) : null,
      });
      toast.success('Ledger updated');
      setEditModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">Ledger Transaction Entry : {ledger.name}</h1>
            <p className="text-sm text-slate-500">
              {ledger.type_name} ({ledger.behaviour}) · {ledger.place || 'No location'} · {ledger.phone || 'No phone'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openEditModal} className="btn-secondary text-xs gap-1">
            <PencilSquareIcon className="h-4 w-4" />
            Edit
          </button>
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
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 ${hasInterest ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2`}>
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
              {ledger.interest_rate}% <span className="text-xs font-normal">({ledger.scheme_name || ledger.interest_scheme})</span>
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

      {/* Transaction Entry — redirect to dedicated page */}
      {isActive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate(`/payment-entry?type=payment&ledgerId=${id}`)}
            className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-400 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <ArrowUpCircleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">Record Payment</p>
              <p className="text-xs text-slate-400">Go to Payment &amp; Receipt Entry</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/payment-entry?type=receipt&ledgerId=${id}`)}
            className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-400 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50">
              <ArrowDownCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">Record Receipt</p>
              <p className="text-xs text-slate-400">Go to Payment &amp; Receipt Entry</p>
            </div>
          </button>
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
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isPayment ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
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
                          {printReceiptsPaymentEnabled && (
                            <button
                              onClick={() => openTxnPreview(txn)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Print receipt"
                            >
                              <PrinterIcon className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Edit Ledger Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Ledger" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-2" noValidate>
          <div>
            <label className="label">Ledger Type *</label>
            <select
              name="ledger_type_id"
              value={editForm.ledger_type_id || ''}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              className={`input-field ${editErrors.ledger_type_id ? 'border-red-400' : ''}`}
            >
              <option value="">— Select type —</option>
              {ledgerTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.behaviour})</option>
              ))}
            </select>
            <FieldError msg={editErrors.ledger_type_id} />
          </div>
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              name="name"
              value={editForm.name || ''}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              className={`input-field ${editErrors.name ? 'border-red-400' : ''}`}
            />
            <FieldError msg={editErrors.name} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input
                type="text"
                name="phone"
                value={editForm.phone || ''}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                className={`input-field ${editErrors.phone ? 'border-red-400' : ''}`}
                maxLength={10}
              />
              <FieldError msg={editErrors.phone} />
            </div>
            <div>
              <label className="label">Place</label>
              <input
                type="text"
                name="place"
                value={editForm.place || ''}
                onChange={handleEditChange}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea
              name="address"
              value={editForm.address || ''}
              onChange={handleEditChange}
              rows={2}
              className="input-field resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">GST Number</label>
              <input
                type="text"
                name="gst_no"
                value={editForm.gst_no || ''}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                className={`input-field uppercase ${editErrors.gst_no ? 'border-red-400' : ''}`}
                maxLength={15}
              />
              <FieldError msg={editErrors.gst_no} />
            </div>
            <div>
              <label className="label">State Code</label>
              <input
                type="text"
                name="state_code"
                value={editForm.state_code || ''}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                className={`input-field ${editErrors.state_code ? 'border-red-400' : ''}`}
                maxLength={2}
              />
              <FieldError msg={editErrors.state_code} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">IGST Applicable</label>
              <div className="flex gap-6 mt-1">
                {['YES', 'NO'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="igst_status"
                      value={opt}
                      checked={editForm.igst_status === opt}
                      onChange={handleEditChange}
                      className="text-trust-blue focus:ring-trust-blue"
                    />
                    <span className="text-sm text-slate-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Ledger Date</label>
              <input
                type="date"
                name="ledger_date"
                value={editForm.ledger_date || ''}
                onChange={handleEditChange}
                className="input-field"
              />
            </div>
          </div>
          {interestEnabled && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Interest Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Interest Rate (%)</label>
                  <input
                    type="number"
                    name="interest_rate"
                    value={editForm.interest_rate || ''}
                    onChange={handleEditChange}
                    onWheel={(e) => e.target.blur()}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Interest Scheme</label>
                  <select
                    name="interest_scheme_id"
                    value={editForm.interest_scheme_id || ''}
                    onChange={handleEditChange}
                    className="input-field"
                  >
                    <option value="">— No Interest —</option>
                    {interestSchemes.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name} ({sch.nature === 'DAILY' ? 'Daily' : 'Monthly'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea
              name="notes"
              value={editForm.notes || ''}
              onChange={handleEditChange}
              rows={2}
              className="input-field resize-none"
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary">
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
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
