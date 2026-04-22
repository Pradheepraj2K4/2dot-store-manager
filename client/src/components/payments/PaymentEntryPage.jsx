import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { transactionApi, ledgerApi, settingsApi, interestApi, interestSchemeApi, transactionCategoryApi } from '../../api';
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
  PlusIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

export default function PaymentEntryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialType = searchParams.get('type') === 'receipt' ? 'receipt' : 'payment';
  const initialLedgerId = searchParams.get('ledgerId');

  const [entryType, setEntryType] = useState(initialType);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Form
  const [form, setForm] = useState({ amount: '', date: todayISO(), notes: '', category_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [nextNum, setNextNum] = useState('');

  // Transaction categories
  const [txnCategories, setTxnCategories] = useState([]);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Transaction list
  const [transactions, setTransactions] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Delete modal
  const [deleteTxnModal, setDeleteTxnModal] = useState({ open: false, txn: null });
  // Edit modal
  const [editTxnModal, setEditTxnModal] = useState({ open: false, txn: null });
  const [editTxnForm, setEditTxnForm] = useState({});
  const [editTxnSaving, setEditTxnSaving] = useState(false);

  // Category filter
  const [filterCategoryId, setFilterCategoryId] = useState('');

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

  // ── Load transaction categories ──────────────────────────────────────
  const fetchTxnCategories = async () => {
    try {
      const res = await transactionCategoryApi.getAll();
      setTxnCategories(res.data || []);
    } catch { /* silent */ }
  };
  useEffect(() => { fetchTxnCategories(); }, []);

  const handleCreateInlineCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      setCreatingCat(true);
      const res = await transactionCategoryApi.create(newCatName.trim());
      setNewCatName('');
      setShowNewCatInput(false);
      toast.success('Category created');
      await fetchTxnCategories();
      if (res?.data?.id) {
        setForm((p) => ({ ...p, category_id: String(res.data.id) }));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreatingCat(false);
    }
  };

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
    setForm({ amount: '', date: todayISO(), notes: '', category_id: '' });
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
    setForm({ amount: '', date: todayISO(), notes: '', category_id: '' });
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
        category_id: form.category_id ? parseInt(form.category_id) : null,
      });
      toast.success(`${entryType === 'payment' ? 'Payment' : 'Receipt'} recorded`);
      setForm({ amount: '', date: todayISO(), notes: '', category_id: '' });
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

  const openEditTxn = (txn) => {
    setEditTxnForm({
      entry_type: txn.entry_type,
      amount: String(txn.amount),
      date: txn.date,
      notes: txn.notes || '',
      reference: txn.reference || '',
      category_id: txn.category_id ? String(txn.category_id) : '',
    });
    setEditTxnModal({ open: true, txn });
  };

  const handleEditTxnSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(editTxnForm.amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Amount must be a positive number'); return; }
    try {
      setEditTxnSaving(true);
      await transactionApi.update(editTxnModal.txn.id, {
        ...editTxnForm,
        amount: amt,
        category_id: editTxnForm.category_id ? parseInt(editTxnForm.category_id) : null,
      });
      toast.success('Transaction updated');
      setEditTxnModal({ open: false, txn: null });
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditTxnSaving(false);
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

  const filteredTransactions = transactions.filter((t) => {
    if (t.entry_type !== entryType) return false;
    if (filterCategoryId && String(t.category_id) !== filterCategoryId) return false;
    return true;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
      <form
        onSubmit={handleSubmit}
        className={`card border-l-4 ${isPayment ? 'border-l-red-400' : 'border-l-green-400'} ${!selectedLedger ? 'opacity-60 pointer-events-none' : ''}`}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                disabled={isLedgerClosed || !selectedLedger}
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
                disabled={isLedgerClosed || !selectedLedger}
              />
            </div>
            <div>
              <label className="label">Category</label>
              {showNewCatInput ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="input-field flex-1"
                    placeholder="New category name"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewCatInput(false); setNewCatName(''); } if (e.key === 'Enter') { e.preventDefault(); handleCreateInlineCategory(); } }}
                    disabled={creatingCat}
                  />
                  <button
                    type="button"
                    onClick={handleCreateInlineCategory}
                    disabled={creatingCat || !newCatName.trim()}
                    className="px-2 py-1 rounded-lg text-xs font-medium text-white bg-trust-blue hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                  >
                    {creatingCat ? '…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                    className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                    className="input-field flex-1"
                    disabled={isLedgerClosed || !selectedLedger}
                  >
                    <option value="">— None —</option>
                    {txnCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(true)}
                    className="p-2 rounded-lg text-slate-500 hover:text-trust-blue hover:bg-blue-50 transition-colors"
                    title="Create new category"
                    disabled={isLedgerClosed || !selectedLedger}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="label">Remarks</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="input-field"
                placeholder="Optional"
                disabled={isLedgerClosed || !selectedLedger}
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
              disabled={submitting || isLedgerClosed || !selectedLedger || !form.amount || Number(form.amount) <= 0}
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

      {/* Transaction History */}
      {selectedLedger && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {isPayment ? 'Payment' : 'Receipt'} History — {selectedLedger.name}
              {!loadingTxns && (
                <span className="ml-1.5 text-slate-400 font-normal">({filteredTransactions.length})</span>
              )}
            </h2>
            {txnCategories.length > 0 && (
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="input-field text-xs py-1 px-2 w-auto min-w-[140px]"
              >
                <option value="">All Categories</option>
                {txnCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
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
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Category</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Remarks</th>
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
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {txn.category_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">{txn.category_name}</span>
                        ) : '—'}
                      </td>
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
                            <>
                              <button
                                type="button"
                                onClick={() => openEditTxn(txn)}
                                className="text-slate-400 hover:text-trust-blue transition-colors"
                                title="Edit transaction"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTxnModal({ open: true, txn })}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Delete transaction"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
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

      {/* Edit Transaction Modal */}
      <Modal
        open={editTxnModal.open}
        onClose={() => setEditTxnModal({ open: false, txn: null })}
        title="Edit Transaction"
        size="sm"
      >
        {editTxnModal.txn && (
          <form onSubmit={handleEditTxnSubmit} className="space-y-4">
            <div>
              <label className="label">Type</label>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mt-1">
                {['payment', 'receipt'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditTxnForm((f) => ({ ...f, entry_type: type }))}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      editTxnForm.entry_type === type
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                value={editTxnForm.amount || ''}
                onChange={(e) => setEditTxnForm((f) => ({ ...f, amount: e.target.value }))}
                onWheel={(e) => e.target.blur()}
                className="input-field mt-1"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={editTxnForm.date || ''}
                onChange={(e) => setEditTxnForm((f) => ({ ...f, date: e.target.value }))}
                className="input-field mt-1"
                required
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                type="text"
                value={editTxnForm.notes || ''}
                onChange={(e) => setEditTxnForm((f) => ({ ...f, notes: e.target.value }))}
                className="input-field mt-1"
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setEditTxnModal({ open: false, txn: null })} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={editTxnSaving}>
                {editTxnSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
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
