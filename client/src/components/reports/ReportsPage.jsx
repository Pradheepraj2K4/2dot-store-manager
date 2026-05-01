import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportApi, ledgerTypeApi, interestSchemeApi, interestApi, transactionCategoryApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
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
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { from: getISODate(monday), to: getISODate(today) };
    }
    case 'this_month':
      return { from: getISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to: getISODate(today) };
    case 'last_month':
      return {
        from: getISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to:   getISODate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'this_year':
      return { from: getISODate(new Date(today.getFullYear(), 0, 1)), to: getISODate(today) };
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
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [searchParams] = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [ledgerTypes, setLedgerTypes]   = useState([]);
  const [interestSchemes, setInterestSchemes] = useState([]);
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [initDone, setInitDone]         = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────
  const [entryTypeFilter, setEntryTypeFilter] = useState(searchParams.get('entryType') || 'all');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [interestSchemeFilter, setInterestSchemeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [activePreset, setActivePreset] = useState('this_month');
  const today = new Date();
  const [customFrom, setCustomFrom] = useState(getISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customTo, setCustomTo]     = useState(todayISO());

  // ── Dropdown state ─────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen]     = useState(false);
  const filterRef = useRef(null);
  const dateRef   = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
      if (dateRef.current   && !dateRef.current.contains(e.target))   setDateOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeFilterCount = [
    entryTypeFilter !== 'all',
    ledgerTypeFilter !== 'all',
    interestSchemeFilter !== 'all',
    categoryFilter !== 'all',
    search.trim() !== '',
  ].filter(Boolean).length;

  function activeDateRange() {
    if (activePreset === 'custom') return { from: customFrom, to: customTo };
    return getDateRange(activePreset);
  }

  // ── Fetch ledger types once ────────────────────────────────────────────
  useEffect(() => {
    ledgerTypeApi.getAll().then((res) => setLedgerTypes(res.data)).catch(() => {});
    transactionCategoryApi.getAll().then((res) => setCategories(res.data || [])).catch(() => {});
    interestApi.isEnabled().then((res) => {
      const enabled = res.data?.enabled === true;
      setInterestEnabled(enabled);
      if (enabled) interestSchemeApi.getAll().then((r) => setInterestSchemes(r.data || [])).catch(() => {});
    }).catch(() => {});
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const range = activeDateRange();
      const params = {};
      if (entryTypeFilter !== 'all') params.entryType = entryTypeFilter;
      if (ledgerTypeFilter !== 'all') params.ledgerTypeId = ledgerTypeFilter;
      if (interestSchemeFilter !== 'all') params.interestSchemeId = interestSchemeFilter;
      if (categoryFilter !== 'all') params.categoryId = categoryFilter;
      if (range) {
        params.fromDate = range.from;
        params.toDate = range.to;
      }
      const res = await reportApi.getTransactions(params);
      setTransactions(res.data);
      setInitDone(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryTypeFilter, ledgerTypeFilter, interestSchemeFilter, categoryFilter, activePreset, customFrom, customTo]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // ── Filtered list (client-side name search) ─────────────────────────────
  const visible = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.trim().toLowerCase();
    return transactions.filter((t) =>
      (t.ledger_name || '').toLowerCase().includes(q) ||
      (t.running_number || '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  // ── Totals ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const paymentTotal = visible.filter((t) => t.entry_type === 'payment').reduce((s, t) => s + t.amount, 0);
    const receiptTotal = visible.filter((t) => t.entry_type === 'receipt').reduce((s, t) => s + t.amount, 0);
    return { payment: paymentTotal, receipt: receiptTotal, total: paymentTotal + receiptTotal };
  }, [visible]);

  // ── Export helpers ──────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const columns = [
      { header: 'Date',       key: 'date',           width: 15 },
      { header: 'Ref #',      key: 'running_number',  width: 18 },
      { header: 'Ledger',     key: 'ledger_name',     width: 25 },
      { header: 'Type',       key: 'entry_type',      width: 12 },
      { header: 'Category',  key: 'category_name',   width: 18 },
      { header: 'Amount',     key: 'amount',          width: 15 },
      { header: 'Remarks',   key: 'notes',           width: 25 },
    ];
    exportToExcel(visible, columns, 'Transaction_Report');
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Ref #', 'Ledger', 'Type', 'Category', 'Amount', 'Remarks'];
    const rows = visible.map((t) => [
      formatDate(t.date),
      t.running_number || '',
      t.ledger_name || '',
      t.entry_type === 'payment' ? 'Payment' : 'Receipt',
      t.category_name || '—',
      formatCurrency(t.amount).replace('₹', 'Rs. '),
      t.notes || '',
    ]);
    exportToPDF('Transaction Report', headers, rows, 'Transaction_Report');
  };

  const range = activeDateRange();

  return (
    <div className="flex flex-col h-full gap-2 min-h-0">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">View and export transaction history</p>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      {initDone && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
          <div className="card text-center py-3 border-red-200">
            <p className="text-xs text-red-600">Payments</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totals.payment)}</p>
          </div>
          <div className="card text-center py-3 border-green-200">
            <p className="text-xs text-green-600">Receipts</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totals.receipt)}</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(totals.total)}</p>
          </div>
        </div>
      )}

      {/* ── Filters toolbar ───────────────────────────────────────────────── */}
      <div className="card p-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">

          {/* ── Filter dropdown ────────────────────────────────────────────── */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => { setFilterOpen((v) => !v); setDateOpen(false); }}
              className={`btn-secondary gap-1.5 ${activeFilterCount > 0 ? 'ring-1 ring-trust-blue text-trust-blue' : ''}`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-trust-blue text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>

            {filterOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-4 flex flex-col gap-4">
                {/* Transaction Type */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Transaction Type</p>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    {[['all', 'All'], ['payment', 'Payments'], ['receipt', 'Receipts']].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setEntryTypeFilter(val)}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          entryTypeFilter === val
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ledger Type */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Ledger Type</p>
                  <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                    {[['all', 'All'], ...ledgerTypes.map((t) => [String(t.id), t.name])].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setLedgerTypeFilter(val)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          ledgerTypeFilter === val
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interest Scheme */}
                {interestEnabled && interestSchemes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Interest Scheme</p>
                    <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                      {[['all', 'All Schemes'], ...interestSchemes.map((s) => [String(s.id), s.name])].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setInterestSchemeFilter(val)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            interestSchemeFilter === val
                              ? 'bg-white text-slate-800 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category */}
                {categories.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Category</p>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="input-field !py-1.5 !text-xs w-full"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Search */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Search</p>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Name / ref #…"
                      className="input-field !pl-8 !py-1.5 !text-xs w-full"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Clear all */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setEntryTypeFilter('all');
                      setLedgerTypeFilter('all');
                      setInterestSchemeFilter('all');
                      setCategoryFilter('all');
                      setSearch('');
                    }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium text-left -mt-1"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Date dropdown ──────────────────────────────────────────────── */}
          <div className="relative" ref={dateRef}>
            <button
              onClick={() => { setDateOpen((v) => !v); setFilterOpen(false); }}
              className="btn-secondary gap-1.5"
            >
              <CalendarDaysIcon className="h-4 w-4" />
              {PRESETS.find((p) => p.key === activePreset)?.label}
              {activePreset !== 'custom' && range && (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  ({formatDate(range.from)} — {formatDate(range.to)})
                </span>
              )}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${dateOpen ? 'rotate-180' : ''}`} />
            </button>

            {dateOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-4 flex flex-col gap-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date Range</p>
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
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="input-field !py-1 !text-xs flex-1"
                    />
                    <span className="text-xs text-slate-400">–</span>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom}
                      max={todayISO()}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="input-field !py-1 !text-xs flex-1"
                    />
                  </div>
                )}
                {activePreset !== 'custom' && range && (
                  <p className="text-xs text-slate-400">{formatDate(range.from)} — {formatDate(range.to)}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Active filter chips ────────────────────────────────────────── */}
          {entryTypeFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {entryTypeFilter === 'payment' ? 'Payments' : 'Receipts'}
              <button onClick={() => setEntryTypeFilter('all')} className="hover:text-blue-900"><XMarkIcon className="h-3 w-3" /></button>
            </span>
          )}
          {ledgerTypeFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {ledgerTypes.find((t) => String(t.id) === ledgerTypeFilter)?.name}
              <button onClick={() => setLedgerTypeFilter('all')} className="hover:text-blue-900"><XMarkIcon className="h-3 w-3" /></button>
            </span>
          )}
          {interestSchemeFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {interestSchemes.find((s) => String(s.id) === interestSchemeFilter)?.name}
              <button onClick={() => setInterestSchemeFilter('all')} className="hover:text-blue-900"><XMarkIcon className="h-3 w-3" /></button>
            </span>
          )}
          {categoryFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {categories.find((c) => String(c.id) === categoryFilter)?.name}
              <button onClick={() => setCategoryFilter('all')} className="hover:text-blue-900"><XMarkIcon className="h-3 w-3" /></button>
            </span>
          )}
          {search.trim() && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              "{search}"
              <button onClick={() => setSearch('')} className="hover:text-blue-900"><XMarkIcon className="h-3 w-3" /></button>
            </span>
          )}

          {/* ── Export ────────────────────────────────────────────────────── */}
          <div className="flex gap-2 ml-auto">
            <button onClick={handleExportExcel} className="btn-secondary gap-2">
              <ArrowDownTrayIcon className="h-4 w-4" />Excel
            </button>
            <button onClick={handleExportPDF} className="btn-secondary gap-2">
              <ArrowDownTrayIcon className="h-4 w-4" />PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && visible.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <BanknotesIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No transactions found for the selected filters</p>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!loading && visible.length > 0 && (
        <div className="card p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-slate-700">Transaction History</h2>
            <span className="text-xs text-slate-400">
              {visible.length} record{visible.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-y-auto overflow-x-auto flex-1">
            <table className="w-full text-sm table-zebra">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Ref #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Ledger</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Entry Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Category</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((txn) => {
                  const isPayment = txn.entry_type === 'payment';
                  return (
                    <tr key={txn.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(txn.date)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{txn.running_number || '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{txn.ledger_name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          txn.behaviour === 'customer'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {txn.type_name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isPayment ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {isPayment ? 'Payment' : 'Receipt'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{txn.category_name || '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${isPayment ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 truncate max-w-[200px]">
                        {txn.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-blue-100 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Total ({visible.length} transactions)
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-800">
                    {formatCurrency(totals.total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
