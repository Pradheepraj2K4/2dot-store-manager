import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { transactionApi, ledgerApi, settingsApi, interestApi, interestSchemeApi } from '../../api';
import { formatCurrency, formatDate, formatDateTime, todayISO } from '../../utils/helpers';
import { buildTransactionReceiptHtml } from '../../utils/transactionReceipt';
import { fetchLogoDataUrl } from '../../utils/interestReceipt';
import LedgerAutocomplete from '../ui/LedgerAutocomplete';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  PrinterIcon,
  TrashIcon,
  BanknotesIcon,
  ArrowPathIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';

export default function PaymentEntryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialType = searchParams.get('type') === 'receipt' ? 'receipt' : 'payment';
  const initialLedgerId = searchParams.get('ledgerId');

  const [entryType, setEntryType] = useState(initialType);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Form
  const [form, setForm] = useState({ amount: '', date: todayISO(), notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [nextNum, setNextNum] = useState('');

  // Transaction list
  const [transactions, setTransactions] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Delete modal
  const [deleteTxnModal, setDeleteTxnModal] = useState({ open: false, txn: null });

  // Interest config
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [interestSchemes, setInterestSchemes] = useState([]);
  const [interestForm, setInterestForm] = useState({ interest_rate: '', interest_scheme_id: '' });
  const [savingInterest, setSavingInterest] = useState(false);

  // Print / receipt
  const [store, setStore] = useState({});
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('a5');
  const [printEnabled, setPrintEnabled] = useState(false);
  const [previewModal, setPreviewModal] = useState({ open: false, html: '' });
  const iframeRef = useRef(null);
  const pendingRefreshRef = useRef(false);

  // ── Load interest module toggle ────────────────────────────────────
  useEffect(() => {
    interestApi.isEnabled().then((res) => setInterestEnabled(res.data.enabled)).catch(() => {});
    interestSchemeApi.getAll().then((res) => setInterestSchemes(res.data || [])).catch(() => {});
  }, []);

  // ── Sync interest form when ledger changes ───────────────────────────
  useEffect(() => {
    if (selectedLedger) {
      setInterestForm({
        interest_rate: selectedLedger.interest_rate != null ? String(selectedLedger.interest_rate) : '',
        interest_scheme_id: selectedLedger.interest_scheme_id != null ? String(selectedLedger.interest_scheme_id) : '',
      });
    }
  }, [selectedLedger?.id]);

  // ── Load store / receipt settings ────────────────────────────────────
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
      setPrintEnabled(pv === true || pv === 'true');
      if (profile.logo_path) {
        const dl = await fetchLogoDataUrl(profile.logo_path);
        setLogoDataUrl(dl);
      }
    })();
  }, []);

  // ── Pre-select ledger from URL param ─────────────────────────────────
  useEffect(() => {
    if (!initialLedgerId) return;
    setLoadingLedger(true);
    ledgerApi
      .getById(initialLedgerId)
      .then((res) => setSelectedLedger(res.data))
      .catch(() => toast.error('Ledger not found'))
      .finally(() => setLoadingLedger(false));
  }, [initialLedgerId]);

  // ── Fetch next voucher number ─────────────────────────────────────────
  useEffect(() => {
    transactionApi
      .getNextRunningNumber(entryType)
      .then((res) => setNextNum(res.data.runningNumber))
      .catch(() => {});
  }, [entryType]);

  // ── Fetch transactions when ledger changes ────────────────────────────
  useEffect(() => {
    if (!selectedLedger) {
      setTransactions([]);
      return;
    }
    setLoadingTxns(true);
    transactionApi
      .getByLedger(selectedLedger.id)
      .then((res) => setTransactions(res.data))
      .catch(() => {})
      .finally(() => setLoadingTxns(false));
  }, [selectedLedger?.id]);

  // ── Refresh helpers ───────────────────────────────────────────────────
  const refreshAll = () => {
    if (!selectedLedger) return;
    // Refresh transaction list
    setLoadingTxns(true);
    transactionApi
      .getByLedger(selectedLedger.id)
      .then((res) => setTransactions(res.data))
      .catch(() => {})
      .finally(() => setLoadingTxns(false));
    // Refresh ledger balance
    ledgerApi
      .getById(selectedLedger.id)
      .then((res) => setSelectedLedger(res.data))
      .catch(() => {});
    // Refresh next number
    transactionApi
      .getNextRunningNumber(entryType)
      .then((res) => setNextNum(res.data.runningNumber))
      .catch(() => {});
  };

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleTypeChange = (type) => {
    setEntryType(type);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('type', type);
      return p;
    });
    setForm({ amount: '', date: todayISO(), notes: '' });
  };

  const handleLedgerSelect = (ledger) => {
    setSelectedLedger(ledger);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (ledger) {
        p.set('ledgerId', ledger.id);
      } else {
        p.delete('ledgerId');
      }
      return p;
    });
    setForm({ amount: '', date: todayISO(), notes: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLedger) { toast.error('Please select a ledger'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      setSubmitting(true);
      const created = await transactionApi.create({
        ledger_id: selectedLedger.id,
        entry_type: entryType,
        amount: parseFloat(form.amount),
        date: form.date,
        notes: form.notes.trim(),
      });
      toast.success(`${entryType === 'payment' ? 'Payment' : 'Receipt'} recorded`);
      setForm({ amount: '', date: todayISO(), notes: '' });
      if (created.data && printEnabled) {
        const html = buildTransactionReceiptHtml({
          txn: created.data,
          ledgerName: selectedLedger.name,
          store,
          logoDataUrl,
          format: receiptFormat,
        });
        pendingRefreshRef.current = true;
        setPreviewModal({ open: true, html });
      } else {
        refreshAll();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async () => {
    try {
      await transactionApi.delete(deleteTxnModal.txn.id);
      toast.success('Transaction deleted');
      setDeleteTxnModal({ open: false, txn: null });
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closePreview = () => {
    setPreviewModal({ open: false, html: '' });
    if (pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      refreshAll();
    }
  };

  const handleSaveInterest = async () => {
    try {
      setSavingInterest(true);
      const updated = await ledgerApi.update(selectedLedger.id, {
        ...selectedLedger,
        interest_rate: parseFloat(interestForm.interest_rate) || 0,
        interest_scheme_id: interestForm.interest_scheme_id ? parseInt(interestForm.interest_scheme_id) : null,
      });
      setSelectedLedger(updated.data);
      toast.success('Interest configuration saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingInterest(false);
    }
  };

  const openPrintPreview = (txn) => {
    const html = buildTransactionReceiptHtml({
      txn,
      ledgerName: selectedLedger?.name,
      store,
      logoDataUrl,
      format: receiptFormat,
    });
    setPreviewModal({ open: true, html });
  };

  // ── Derived values ────────────────────────────────────────────────────
  const isPayment = entryType === 'payment';
  const isLedgerClosed = selectedLedger?.status === 'closed';

  const filteredTransactions = transactions.filter((t) => t.entry_type === entryType);

  const amt = parseFloat(form.amount);
  const projectedBalance = selectedLedger && !isNaN(amt) && amt > 0
    ? (() => {
        let projected = selectedLedger.current_balance ?? 0;
        const beh = selectedLedger.behaviour || 'customer';
        if (beh === 'customer') {
          projected = isPayment ? projected + amt : projected - amt;
        } else {
          projected = isPayment ? projected - amt : projected + amt;
        }
        return projected;
      })()
    : null;
  const wouldGoNegative = projectedBalance !== null && projectedBalance < 0;

  const showInterestSection =
    interestEnabled &&
    selectedLedger &&
    !isLedgerClosed &&
    ((isPayment && selectedLedger.behaviour === 'customer') ||
      (!isPayment && selectedLedger.behaviour === 'supplier'));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Payment &amp; Receipt Entry</h1>
          <p className="text-sm text-slate-500">Record payments and receipts for any ledger</p>
        </div>
        {selectedLedger && (
          <button onClick={refreshAll} className="btn-secondary gap-2">
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        )}
      </div>

      {/* Entry Type Toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => handleTypeChange('payment')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            isPayment
              ? 'bg-white text-red-700 shadow-sm border border-red-100'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ArrowUpCircleIcon className="h-4 w-4" />
          Payment
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('receipt')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            !isPayment
              ? 'bg-white text-green-700 shadow-sm border border-green-100'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ArrowDownCircleIcon className="h-4 w-4" />
          Receipt
        </button>
      </div>

      {/* Ledger Selection */}
      <div className="card">
        <label className="label mb-2">Select Ledger *</label>
        {loadingLedger ? (
          <div className="py-2 text-sm text-slate-400">Loading ledger…</div>
        ) : (
          <LedgerAutocomplete
            value={selectedLedger}
            onChange={handleLedgerSelect}
            placeholder="Search by name, phone, or place…"
          />
        )}
        {selectedLedger && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm items-center">
            <span>
              <span className="text-xs text-slate-500">Balance: </span>
              <span className="font-bold text-debit-red">{formatCurrency(selectedLedger.current_balance || 0)}</span>
            </span>
            <span>
              <span className="text-xs text-slate-500">Type: </span>
              <span className="font-medium">{selectedLedger.type_name}</span>
            </span>
            <span>
              <span className="text-xs text-slate-500">Status: </span>
              <span className={`font-medium ${selectedLedger.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                {selectedLedger.status === 'active' ? 'Active' : 'Closed'}
              </span>
            </span>
            {interestEnabled && selectedLedger.interest_scheme_id && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                <CalculatorIcon className="h-3 w-3" />
                {selectedLedger.interest_rate}% · {selectedLedger.scheme_name || selectedLedger.interest_scheme}
              </span>
            )}
            <Link
              to={`/ledger/${selectedLedger.id}`}
              className="text-trust-blue hover:underline text-xs font-medium ml-auto"
            >
              View Ledger →
            </Link>
          </div>
        )}
      </div>

      {/* Entry Form */}
      {selectedLedger && (
        <form
          onSubmit={handleSubmit}
          className={`card border-l-4 ${isPayment ? 'border-l-red-400' : 'border-l-green-400'}`}
        >
          <div className="flex items-center gap-2 mb-4">
            {isPayment
              ? <ArrowUpCircleIcon className="h-5 w-5 text-red-600" />
              : <ArrowDownCircleIcon className="h-5 w-5 text-green-600" />
            }
            <h3 className={`text-sm font-semibold ${isPayment ? 'text-red-700' : 'text-green-700'}`}>
              New {isPayment ? 'Payment' : 'Receipt'}
            </h3>
            {nextNum && (
              <span className="ml-auto text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {nextNum}
              </span>
            )}
          </div>

          {isLedgerClosed && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              This ledger is closed. No new transactions can be recorded.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Amount *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className={`input-field ${wouldGoNegative ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="0.00"
                disabled={isLedgerClosed}
                autoFocus
              />
              {projectedBalance !== null && (
                <p className={`text-xs mt-1 ${wouldGoNegative ? 'text-red-500' : 'text-slate-500'}`}>
                  Balance after entry:{' '}
                  <span className="font-medium">{formatCurrency(projectedBalance)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="input-field"
                disabled={isLedgerClosed}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="input-field"
                placeholder="Optional"
                disabled={isLedgerClosed}
              />
            </div>
          </div>

          {showInterestSection && (
            <>
              <div className="border-t border-slate-200 pt-3 mt-1">
                <div className="flex items-center gap-1.5 mb-3">
                  <CalculatorIcon className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700">Interest Configuration</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Interest Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={interestForm.interest_rate}
                      onChange={(e) => setInterestForm((p) => ({ ...p, interest_rate: e.target.value }))}
                      onWheel={(e) => e.target.blur()}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Interest Scheme</label>
                    <select
                      value={interestForm.interest_scheme_id}
                      onChange={(e) => setInterestForm((p) => ({ ...p, interest_scheme_id: e.target.value }))}
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
            </>
          )}

          <div className="flex justify-end gap-2 mt-3">
            {showInterestSection && (
              <button
                type="button"
                onClick={handleSaveInterest}
                disabled={savingInterest}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 transition-colors"
              >
                {savingInterest ? 'Saving…' : 'Save Interest'}
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || isLedgerClosed || !form.amount || Number(form.amount) <= 0}
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
      )}

      {/* Empty prompt when no ledger selected */}
      {!selectedLedger && !loadingLedger && (
        <div className="card py-16 flex flex-col items-center text-center">
          <BanknotesIcon className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">Select a ledger to get started</p>
          <p className="text-slate-400 text-sm mt-1">
            Search for a ledger above to record {isPayment ? 'payments' : 'receipts'}
          </p>
        </div>
      )}

      {/* Transaction History */}
      {selectedLedger && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {isPayment ? 'Payment' : 'Receipt'} History — {selectedLedger.name}
              {!loadingTxns && (
                <span className="ml-1.5 text-slate-400 font-normal">({filteredTransactions.length})</span>
              )}
            </h2>
          </div>

          {loadingTxns ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No {isPayment ? 'payment' : 'receipt'} records found for this ledger
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-zebra">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Voucher #</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Notes</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Recorded At</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{txn.running_number}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${isPayment ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(txn.date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[200px] truncate">{txn.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{formatDateTime(txn.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {printEnabled && (
                            <button
                              type="button"
                              onClick={() => openPrintPreview(txn)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Print receipt"
                            >
                              <PrinterIcon className="w-4 h-4" />
                            </button>
                          )}
                          {selectedLedger.status === 'active' && (
                            <button
                              type="button"
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receipt Preview Modal */}
      <Modal open={previewModal.open} onClose={closePreview} title="Receipt Preview" size="lg">
        <div className="space-y-3">
          <iframe
            ref={iframeRef}
            srcDoc={previewModal.html}
            title="Receipt Preview"
            className="w-full border border-slate-200 rounded"
            style={{ minHeight: 300, maxHeight: 600, overflowX: 'hidden' }}
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc) e.target.style.height = Math.min(doc.body.scrollHeight + 4, 600) + 'px';
            }}
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closePreview} className="btn-secondary">Close</button>
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTxnModal.open}
        onClose={() => setDeleteTxnModal({ open: false, txn: null })}
        title="Delete Transaction"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete this transaction of{' '}
          <strong>{deleteTxnModal.txn && formatCurrency(deleteTxnModal.txn.amount)}</strong>?{' '}
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setDeleteTxnModal({ open: false, txn: null })}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="button" onClick={handleDeleteTransaction} className="btn-danger">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
