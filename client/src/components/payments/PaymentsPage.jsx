import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { partyApi, transactionApi, settingsApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import ReceiptPreview from '../receipts/ReceiptPreview';
import PartyAutocomplete from '../ui/PartyAutocomplete';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  CreditCardIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

// ── Date range helpers ────────────────────────────────────────────────────────
function getISODate(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'this_week': {
      const day = today.getDay(); // 0 Sun … 6 Sat
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7)); // roll back to Monday
      return { from: getISODate(monday), to: getISODate(today) };
    }
    case 'this_month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: getISODate(from), to: getISODate(today) };
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to   = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: getISODate(from), to: getISODate(to) };
    }
    case 'this_year': {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: getISODate(from), to: getISODate(today) };
    }
    default:
      return null;
  }
}

const PRESETS = [
  { key: 'this_week',  label: 'This Week'  },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year',  label: 'This Year'  },
  { key: 'custom',     label: 'Custom'     },
];

export default function PaymentsPage() {
  // ── Server data ────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [parties, setParties] = useState([]);
  const [storeProfile, setStoreProfile] = useState({});
  const [receiptConfig, setReceiptConfig] = useState({});

  // ── Loading: split so filters don't re-render the whole page ──────────
  const [initialLoading, setInitialLoading] = useState(true);
  const [txnLoading, setTxnLoading]         = useState(false);
  const isMounted = useRef(false);

  // ── Modals ─────────────────────────────────────────────────────────────
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ open: false, transaction: null });
  const [nextReceiptNumber, setNextReceiptNumber] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, txn: null });
  const [deleting, setDeleting] = useState(false);

  // ── URL params (for deep-link from Dashboard) ─────────────────────────
  const [searchParams] = useSearchParams();

  // ── Filters (client-side: tab + search; server-side: date range) ───────
  const [partyTab, setPartyTab]       = useState('all'); // 'all' | 'customer' | 'supplier'
  const [txnTypeTab, setTxnTypeTab]   = useState(() => searchParams.get('type') || 'all'); // 'all' | 'credit' | 'debit'
  const [search, setSearch]           = useState('');
  const [activePreset, setActivePreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState(
    () => getISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [customTo, setCustomTo] = useState(todayISO);

  function activeDateRange() {
    if (activePreset === 'custom') return { from: customFrom, to: customTo };
    return getDateRange(activePreset);
  }

  // ── Payment form ───────────────────────────────────────────────────────
  const [form, setForm] = useState({
    party_id: '',
    date: todayISO(),
    type: 'credit',
    amount: '',
    reference: '',
    notes: '',
  });
  const [submitting, setSubmitting]             = useState(false);
  const [selectedPartyBalance, setSelectedPartyBalance] = useState(null);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [paymentTouched, setPaymentTouched] = useState({});

  function validatePaymentForm(f) {
    const errs = {};
    if (!f.party_id) errs.party_id = 'Please select a party.';
    if (!f.date) errs.date = 'Date is required.';
    const amt = parseFloat(f.amount);
    if (!f.amount) errs.amount = 'Amount is required.';
    else if (isNaN(amt) || amt <= 0) errs.amount = 'Amount must be a positive number.';
    if (f.reference && f.reference.length > 100) errs.reference = 'Reference must be 100 characters or less.';
    return errs;
  }

  // ── Refs for Enter-key navigation in modal form ────────────────────────
  const partyRef     = useRef(null);
  const dateRef      = useRef(null);
  const typeRef      = useRef(null);
  const amountRef    = useRef(null);
  const referenceRef = useRef(null);
  const notesRef     = useRef(null);
  const submitRef    = useRef(null);

  // ── Initial load: fetch everything once ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setInitialLoading(true);
        const range = activeDateRange();
        const [txnRes, partiesRes, profileRes, configRes] = await Promise.all([
          transactionApi.getAll({ startDate: range.from, endDate: range.to }),
          partyApi.getAll(),
          settingsApi.getStoreProfile(),
          settingsApi.getReceiptConfig(),
        ]);
        setTransactions(txnRes.data);
        setParties(partiesRes.data);
        setStoreProfile(profileRes.data);
        setReceiptConfig(configRes.data || {});
      } catch (err) {
        toast.error(err.message);
      } finally {
        setInitialLoading(false);
        isMounted.current = true;
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Subsequent filter changes: only re-fetch transactions ─────────────
  useEffect(() => {
    if (!isMounted.current) return; // skip until initial load completes
    const fetchTransactions = async () => {
      try {
        setTxnLoading(true);
        const range = activeDateRange();
        const res = await transactionApi.getAll({ startDate: range.from, endDate: range.to });
        setTransactions(res.data);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setTxnLoading(false);
      }
    };
    fetchTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, customFrom, customTo]);

  // ── Client-side filtering (tab + search) applied on already-fetched data
  const visibleTransactions = useMemo(() => {
    let list = transactions;
    if (partyTab !== 'all') {
      list = list.filter((t) => t.party_type === partyTab);
    }
    if (txnTypeTab !== 'all') {
      list = list.filter((t) => t.type === txnTypeTab);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.party_name?.toLowerCase().includes(q));
    }
    return list;
  }, [transactions, partyTab, txnTypeTab, search]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const openPaymentModal = async () => {
    setEditingTransaction(null);
    setForm({ party_id: '', date: todayISO(), type: 'credit', amount: '', reference: '', notes: '' });
    setPaymentModalOpen(true);
    try {
      const res = await transactionApi.getNextReceiptNumber('credit');
      setNextReceiptNumber(res.data.receipt_number);
    } catch {
      setNextReceiptNumber(null);
    }
  };

  const openEditModal = (txn) => {
    setEditingTransaction(txn);
    setForm({
      party_id: txn.party_id,
      date: txn.date,
      type: txn.type,
      amount: String(txn.amount),
      reference: txn.reference || '',
      notes: txn.notes || '',
    });
    setNextReceiptNumber(txn.receipt_number);
    setSelectedPartyBalance(null);
    setPaymentErrors({});
    setPaymentTouched({});
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setEditingTransaction(null);
    setSelectedPartyBalance(null);
    setNextReceiptNumber(null);
    setPaymentErrors({});
    setPaymentTouched({});
  };

  const handleTypeChange = async (newType) => {
    setForm((prev) => ({ ...prev, type: newType }));
    // Don't re-fetch receipt number in edit mode — it's locked to the original
    if (editingTransaction) return;
    try {
      const res = await transactionApi.getNextReceiptNumber(newType);
      setNextReceiptNumber(res.data.receipt_number);
    } catch {
      setNextReceiptNumber(null);
    }
  };

  const handlePartyChange = async (partyId) => {
    const newForm = { ...form, party_id: partyId };
    setForm(newForm);
    if (paymentTouched.party_id) setPaymentErrors(validatePaymentForm(newForm));
    if (partyId) {
      try {
        const res = await transactionApi.getPartyBalance(partyId);
        setSelectedPartyBalance(res.data);
      } catch {
        setSelectedPartyBalance(null);
      }
    } else {
      setSelectedPartyBalance(null);
    }
  };

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Mark all fields touched and validate
    const allTouched = { party_id: true, date: true, amount: true, reference: true };
    setPaymentTouched(allTouched);
    const errs = validatePaymentForm(form);
    setPaymentErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setSubmitting(true);
      const payload = {
        party_id: parseInt(form.party_id),
        date: form.date,
        type: form.type,
        amount: parseFloat(form.amount),
        reference: form.reference,
        notes: form.notes,
      };

      if (editingTransaction) {
        await transactionApi.updatePayment(editingTransaction.id, payload);
        toast.success('Payment updated successfully');
        closePaymentModal();
      } else {
        const res = await transactionApi.recordPayment(payload);
        toast.success('Payment recorded successfully');
        closePaymentModal();
        setReceiptModal({ open: true, transaction: res.data });
      }

      const range = activeDateRange();
      const txnRes = await transactionApi.getAll({ startDate: range.from, endDate: range.to });
      setTransactions(txnRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.txn) return;
    try {
      setDeleting(true);
      await transactionApi.deletePayment(deleteConfirm.txn.id);
      toast.success('Payment deleted');
      setDeleteConfirm({ open: false, txn: null });
      const range = activeDateRange();
      const txnRes = await transactionApi.getAll({ startDate: range.from, endDate: range.to });
      setTransactions(txnRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Footer totals (must be before any early return) ─────────────────
  const footerTotals = useMemo(() => {
    const credits = visibleTransactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debits  = visibleTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return { credits, debits, net: credits - debits };
  }, [visibleTransactions]);

  // ── Full-page spinner only on first load ───────────────────────────────
  if (initialLoading) return <LoadingSpinner className="py-20" size="lg" />;

  const range = activeDateRange();

  const TABS = [
    { key: 'all',      label: 'All',       count: transactions.length },
    { key: 'customer', label: 'Customers',  count: transactions.filter(t => t.party_type === 'customer').length },
    { key: 'supplier', label: 'Suppliers',  count: transactions.filter(t => t.party_type === 'supplier').length },
  ];

  const TXN_TYPE_TABS = [
    { key: 'all',    label: 'All',    count: transactions.length },
    { key: 'credit', label: 'Credit', count: transactions.filter(t => t.type === 'credit').length },
    { key: 'debit',  label: 'Debit',  count: transactions.filter(t => t.type === 'debit').length },
  ];

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">

      {/* ── Row 1: Page header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record and manage payment entries</p>
        </div>
        <button onClick={openPaymentModal} className="btn-primary gap-2">
          <PlusIcon className="h-4 w-4" />
          New Payment
        </button>
      </div>

      {/* ── Row 2: Tabs + Search ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Party segment tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPartyTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                partyTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                partyTab === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Credit/Debit type tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {TXN_TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTxnTypeTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                txnTypeTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                txnTypeTab === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-52">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by party name…"
            className="input-field !pl-8 !py-1.5 !text-xs w-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Row 3: Date period filter ────────────────────────────────── */}
      <div className="card p-3 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Period:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePreset(p.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activePreset === p.key
                  ? 'bg-trust-blue text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {activePreset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap sm:ml-2">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input-field !py-1 !text-xs w-36"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayISO()}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input-field !py-1 !text-xs w-36"
            />
          </div>
        )}

        {activePreset !== 'custom' && (
          <span className="text-xs text-slate-400 sm:ml-auto">
            {formatDate(range.from)} — {formatDate(range.to)}
          </span>
        )}
      </div>

      {/* ── Row 4: Records table — grows + scrolls internally ────────── */}
      {!txnLoading && visibleTransactions.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
            icon={CreditCardIcon}
            title="No payments found"
            description={
              search
                ? `No payments matching "${search}" in the selected period`
                : `No payments recorded for the selected period (${formatDate(range.from)} – ${formatDate(range.to)})`
            }
            action={
              <button onClick={() => setPaymentModalOpen(true)} className="btn-primary gap-2">
                <PlusIcon className="h-4 w-4" />
                New Payment
              </button>
            }
          />
        </div>
      ) : (
        <div className="card p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Sticky table header bar */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-slate-700">
              Payments
              <span className="ml-2 text-xs font-normal text-slate-400">
                {formatDate(range.from)} — {formatDate(range.to)}
              </span>
            </h2>
            <div className="flex items-center gap-3">
              {txnLoading && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-trust-blue" />
                  Loading…
                </span>
              )}
              <span className="text-xs text-slate-400">
                {visibleTransactions.length} record{visibleTransactions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {/* Scrollable table body */}
          <div className="overflow-y-auto overflow-x-auto flex-1">
            <table className="w-full text-sm table-zebra">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Receipt #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Party</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Balance After</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(txn.date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{txn.receipt_number}</td>
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="font-medium text-slate-800">{txn.party_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{txn.party_type}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={txn.type === 'credit' ? 'badge-credit' : 'badge-debit'}>
                        {txn.type.toUpperCase()}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${txn.type === 'credit' ? 'text-credit-green' : 'text-debit-red'}`}>
                      {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${txn.balance_after >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                      {formatCurrency(txn.balance_after)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(txn)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-trust-blue transition-colors"
                          title="Edit Payment"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ open: true, txn })}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Delete Payment"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setReceiptModal({ open: true, transaction: txn })}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                          title="View Receipt"
                        >
                          <DocumentTextIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* ── Footer totals ── */}
              <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {visibleTransactions.length} record{visibleTransactions.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-2.5 text-center"></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-credit-green font-semibold">+{formatCurrency(footerTotals.credits)}</span>
                      <span className="text-xs text-debit-red font-semibold">-{formatCurrency(footerTotals.debits)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-sm font-bold ${
                      footerTotals.net >= 0 ? 'text-credit-green' : 'text-debit-red'
                    }`}>
                      {footerTotals.net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(footerTotals.net))}
                    </span>
                    <div className="text-[10px] text-slate-400">net</div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, txn: null })}
        title="Delete Payment"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete payment{' '}
            <span className="font-mono font-semibold text-slate-800">
              {deleteConfirm.txn?.receipt_number}
            </span>
            {' '}for{' '}
            <span className="font-semibold text-slate-800">{deleteConfirm.txn?.party_name}</span>?
            <br />
            <span className="text-xs text-red-500 mt-1 block">This action cannot be undone. Balances will be recalculated.</span>
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteConfirm({ open: false, txn: null })}
              className="btn-secondary"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Entry / Edit Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={closePaymentModal}
        title={editingTransaction ? 'Edit Payment' : 'Record Payment'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Receipt number preview */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <span className="text-xs text-slate-500">Receipt No.</span>
            <div className="flex items-center gap-2">
              {editingTransaction && (
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">locked</span>
              )}
              <span className="font-mono font-semibold text-sm text-slate-700 tracking-wide">
                {nextReceiptNumber ?? '—'}
              </span>
            </div>
          </div>
          <div>
            <label className="label">Party *</label>
            {editingTransaction ? (
              <div className="flex items-center gap-2 input-field bg-slate-50 cursor-not-allowed">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 truncate">{editingTransaction.party_name}</p>
                  <p className="text-xs text-slate-400 capitalize">{editingTransaction.party_type}</p>
                </div>
              </div>
            ) : (
              <>
                <PartyAutocomplete
                  ref={partyRef}
                  parties={parties}
                  value={form.party_id}
                  onChange={handlePartyChange}
                  onEnterWhenSelected={() => dateRef.current?.focus()}
                  placeholder="Search for customer or supplier..."
                />
                {paymentErrors.party_id && paymentTouched.party_id && (
                  <p className="text-xs text-red-500 mt-1">{paymentErrors.party_id}</p>
                )}
              </>
            )}
          </div>

          {selectedPartyBalance && (
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <p className="text-xs text-slate-500">Current Outstanding Balance</p>
              <p className={`text-lg font-bold ${selectedPartyBalance.current_balance >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                {formatCurrency(selectedPartyBalance.current_balance)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input
                ref={dateRef}
                type="date"
                value={form.date}
                onChange={(e) => {
                  const newForm = { ...form, date: e.target.value };
                  setForm(newForm);
                  if (paymentTouched.date) setPaymentErrors(validatePaymentForm(newForm));
                }}
                onBlur={() => {
                  setPaymentTouched((p) => ({ ...p, date: true }));
                  setPaymentErrors(validatePaymentForm(form));
                }}
                onKeyDown={(e) => handleKeyDown(e, typeRef)}
                className={`input-field ${paymentErrors.date && paymentTouched.date ? 'border-red-400' : ''}`}
              />
              {paymentErrors.date && paymentTouched.date && (
                <p className="text-xs text-red-500 mt-1">{paymentErrors.date}</p>
              )}
            </div>
            <div>
              <label className="label">Type *</label>
              <select
                ref={typeRef}
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, amountRef)}
                className="input-field"
              >
                {(() => {
                  const selectedParty = parties.find(p => p.id === parseInt(form.party_id));
                  const isCustomer = selectedParty?.type === 'customer';
                  
                  if (isCustomer) {
                    return (
                      <>
                        <option value="credit">Credit (Payment Received)</option>
                        <option value="debit">Debit (Credit Sale)</option>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <option value="credit">Credit (Purchase on Credit)</option>
                        <option value="debit">Debit (Payment Made)</option>
                      </>
                    );
                  }
                })()}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {(() => {
                  const selectedParty = parties.find(p => p.id === parseInt(form.party_id));
                  const isCustomer = selectedParty?.type === 'customer';
                  
                  if (form.type === 'credit') {
                    return isCustomer 
                      ? 'Money received from customer - reduces what they owe' 
                      : 'Goods/services purchased on credit - increases what we owe';
                  } else {
                    return isCustomer 
                      ? 'Goods/services sold on credit - increases what they owe' 
                      : 'Money paid to supplier - reduces what we owe';
                  }
                })()}
              </p>
            </div>
          </div>

          <div>
            <label className="label">Amount *</label>
            <input
              ref={amountRef}
              type="number"
              value={form.amount}
              onChange={(e) => {
                const newForm = { ...form, amount: e.target.value };
                setForm(newForm);
                if (paymentTouched.amount) setPaymentErrors(validatePaymentForm(newForm));
              }}
              onBlur={() => {
                setPaymentTouched((p) => ({ ...p, amount: true }));
                setPaymentErrors(validatePaymentForm(form));
              }}
              onKeyDown={(e) => handleKeyDown(e, referenceRef)}
              step="0.01"
              min="0.01"
              className={`input-field ${paymentErrors.amount && paymentTouched.amount ? 'border-red-400' : ''}`}
              placeholder="0.00"
            />
            {paymentErrors.amount && paymentTouched.amount && (
              <p className="text-xs text-red-500 mt-1">{paymentErrors.amount}</p>
            )}
          </div>

          <div>
            <label className="label">Reference</label>
            <input
              ref={referenceRef}
              type="text"
              value={form.reference}
              onChange={(e) => {
                const newForm = { ...form, reference: e.target.value };
                setForm(newForm);
                if (paymentTouched.reference) setPaymentErrors(validatePaymentForm(newForm));
              }}
              onBlur={() => {
                setPaymentTouched((p) => ({ ...p, reference: true }));
                setPaymentErrors(validatePaymentForm(form));
              }}
              onKeyDown={(e) => handleKeyDown(e, notesRef)}
              maxLength={100}
              className={`input-field ${paymentErrors.reference && paymentTouched.reference ? 'border-red-400' : ''}`}
              placeholder="Check number, invoice ref, etc."
            />
            {paymentErrors.reference && paymentTouched.reference && (
              <p className="text-xs text-red-500 mt-1">{paymentErrors.reference}</p>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              ref={notesRef}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              onKeyDown={(e) => handleKeyDown(e, submitRef)}
              rows={2}
              className="input-field resize-none"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closePaymentModal}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button ref={submitRef} type="submit" disabled={submitting} className="btn-primary">
              {submitting
                ? (editingTransaction ? 'Saving...' : 'Recording...')
                : (editingTransaction ? 'Save Changes' : 'Record Payment')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        open={receiptModal.open}
        onClose={() => setReceiptModal({ open: false, transaction: null })}
        title="Payment Receipt"
        size="lg"
      >
        {receiptModal.transaction && (
          <>
            <div className="flex items-center justify-between px-1 pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Payment ID</span>
                <span className="font-mono font-semibold text-sm text-slate-700">
                  #{receiptModal.transaction.id}
                </span>
              </div>
              {receiptModal.transaction.receipt_number && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Receipt No.</span>
                  <span className="font-mono text-xs text-slate-600">
                    {receiptModal.transaction.receipt_number}
                  </span>
                </div>
              )}
            </div>
            <ReceiptPreview
              transaction={receiptModal.transaction}
              storeProfile={storeProfile}
              receiptConfig={receiptConfig}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
