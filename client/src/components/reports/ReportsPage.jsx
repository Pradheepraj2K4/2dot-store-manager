import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { partyApi, transactionApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import PartyAutocomplete from '../ui/PartyAutocomplete';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon,
  FunnelIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
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
  // ── URL params ──────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Shared ─────────────────────────────────────────────────────────────
  const [parties, setParties]         = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [initLoading, setInitLoading] = useState(true);
  const [tab, setTab]                 = useState(() => searchParams.get('tab') || 'outstanding');

  // ── Outstanding filters ─────────────────────────────────────────────────
  const [outTab, setOutTab]       = useState(() => searchParams.get('type') || 'all');   // 'all' | 'customer' | 'supplier'
  const [outSearch, setOutSearch] = useState('');

  // ── Statement state ─────────────────────────────────────────────────────
  const [selectedParty, setSelectedParty] = useState('');
  const [activePreset, setActivePreset]   = useState('this_month');
  const today = new Date();
  const [customFrom, setCustomFrom] = useState(getISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customTo, setCustomTo]     = useState(todayISO());
  const [statement, setStatement]   = useState(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  function activeDateRange() {
    if (activePreset === 'custom') return { from: customFrom, to: customTo };
    return getDateRange(activePreset);
  }

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [partiesRes, outstandingRes] = await Promise.all([
          partyApi.getAll(),
          transactionApi.getOutstanding(),
        ]);
        setParties(partiesRes.data);
        setOutstanding(outstandingRes.data);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  // ── Re-fetch statement when date changes (only after first fetch) ───────
  useEffect(() => {
    if (!hasFetchedRef.current || !selectedParty) return;
    fetchStatement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, customFrom, customTo]);

  const fetchStatement = async () => {
    if (!selectedParty) { toast.error('Please select a party'); return; }
    const range = activeDateRange();
    try {
      setStmtLoading(true);
      const res = await transactionApi.getStatement(selectedParty, {
        startDate: range.from,
        endDate:   range.to,
      });
      setStatement(res.data);
      hasFetchedRef.current = true;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStmtLoading(false);
    }
  };

  // ── Outstanding filtered list ───────────────────────────────────────────
  const visibleOutstanding = useMemo(() => {
    let list = outstanding;
    if (outTab !== 'all') list = list.filter((p) => p.type === outTab);
    if (outSearch.trim()) {
      const q = outSearch.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [outstanding, outTab, outSearch]);

  const OUT_TABS = [
    { key: 'all',      label: 'All',       count: outstanding.length },
    { key: 'customer', label: 'Customers', count: outstanding.filter((p) => p.type === 'customer').length },
    { key: 'supplier', label: 'Suppliers', count: outstanding.filter((p) => p.type === 'supplier').length },
  ];

  // ── Outstanding totals ──────────────────────────────────────────────────
  const outstandingTotals = useMemo(() => ({
    opening:  visibleOutstanding.reduce((s, p) => s + (p.opening_balance  || 0), 0),
    credits:  visibleOutstanding.reduce((s, p) => s + (p.total_credit     || 0), 0),
    debits:   visibleOutstanding.reduce((s, p) => s + (p.total_debit      || 0), 0),
    balance:  visibleOutstanding.reduce((s, p) => s + (p.current_balance  || 0), 0),
  }), [visibleOutstanding]);

  // ── Export helpers ──────────────────────────────────────────────────────
  const exportOutstandingExcel = () => {
    const columns = [
      { header: 'Name',            key: 'name',            width: 25 },
      { header: 'Type',            key: 'type',            width: 12 },
      { header: 'Phone',           key: 'phone',           width: 15 },
      { header: 'Place',           key: 'place',           width: 15 },
      { header: 'Opening Bal.',    key: 'opening_balance', width: 15 },
      { header: 'Total Credit',    key: 'total_credit',    width: 15 },
      { header: 'Total Debit',     key: 'total_debit',     width: 15 },
      { header: 'Current Balance', key: 'current_balance', width: 18 },
    ];
    exportToExcel(visibleOutstanding, columns, 'Outstanding_Report');
  };

  const exportOutstandingPDF = () => {
    const headers = ['Name', 'Type', 'Opening', 'Credits', 'Debits', 'Balance'];
    const rows = visibleOutstanding.map((p) => [
      p.name,
      p.type,
      formatCurrency(p.opening_balance).replace('₹', 'Rs. '),
      formatCurrency(p.total_credit).replace('₹', 'Rs. '),
      formatCurrency(p.total_debit).replace('₹', 'Rs. '),
      formatCurrency(p.current_balance).replace('₹', 'Rs. '),
    ]);
    exportToPDF('Outstanding Balances Report', headers, rows, 'Outstanding_Report');
  };

  const exportStatementExcel = () => {
    if (!statement) return;
    const columns = [
      { header: 'Date',          key: 'date',           width: 15 },
      { header: 'Receipt #',     key: 'receipt_number', width: 18 },
      { header: 'Type',          key: 'type',           width: 10 },
      { header: 'Amount',        key: 'amount',         width: 15 },
      { header: 'Balance After', key: 'balance_after',  width: 15 },
      { header: 'Reference',     key: 'reference',      width: 20 },
      { header: 'Notes',         key: 'notes',          width: 25 },
    ];
    exportToExcel(statement.transactions, columns, `Statement_${statement.party.name}`);
  };

  const exportStatementPDF = () => {
    if (!statement) return;
    const headers = ['Date', 'Receipt #', 'Type', 'Amount', 'Balance', 'Reference'];
    const rows = statement.transactions.map((t) => [
      formatDate(t.date),
      t.receipt_number || '',
      t.type.toUpperCase(),
      formatCurrency(t.amount).replace('₹', 'Rs. '),
      formatCurrency(t.balance_after).replace('₹', 'Rs. '),
      t.reference || '',
    ]);
    exportToPDF(
      `Statement of Account — ${statement.party.name}`,
      headers, rows,
      `Statement_${statement.party.name}`
    );
  };

  // ── Full-page spinner on first load only ────────────────────────────────
  if (initLoading) return <LoadingSpinner className="py-20" size="lg" />;

  const range = activeDateRange();

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Generate and export financial reports</p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200 shrink-0">
        {[
          { key: 'outstanding', label: 'Outstanding Balances'  },
          { key: 'statement',   label: 'Statement of Account' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-trust-blue text-trust-blue'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════ OUTSTANDING BALANCES ══════════════════════════════════════════ */}
      {tab === 'outstanding' && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">

          {/* Filter bar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Type tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {OUT_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setOutTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    outTab === t.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    outTab === t.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-52">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={outSearch}
                onChange={(e) => setOutSearch(e.target.value)}
                placeholder="Search by name…"
                className="input-field !pl-8 !py-1.5 !text-xs w-full"
              />
              {outSearch && (
                <button
                  onClick={() => setOutSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs leading-none"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Export */}
            <div className="flex gap-2 ml-auto">
              <button onClick={exportOutstandingExcel} className="btn-secondary gap-2">
                <ArrowDownTrayIcon className="h-4 w-4" />Excel
              </button>
              <button onClick={exportOutstandingPDF} className="btn-secondary gap-2">
                <ArrowDownTrayIcon className="h-4 w-4" />PDF
              </button>
            </div>
          </div>

          {/* Table card */}
          <div className="card p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-slate-700">Outstanding Balances</h2>
              <span className="text-xs text-slate-400">
                {visibleOutstanding.length} record{visibleOutstanding.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-y-auto overflow-x-auto flex-1">
              <table className="w-full text-sm table-zebra">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Phone</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Place</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Opening</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Credits</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Debits</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOutstanding.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">
                        {outSearch ? `No results matching "${outSearch}"` : 'No data available'}
                      </td>
                    </tr>
                  ) : (
                    visibleOutstanding.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                        <td className="px-4 py-2.5 text-slate-600 capitalize">{p.type}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.phone || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.place || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(p.opening_balance)}</td>
                        <td className="px-4 py-2.5 text-right text-credit-green">{formatCurrency(p.total_credit)}</td>
                        <td className="px-4 py-2.5 text-right text-debit-red">{formatCurrency(p.total_debit)}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${p.current_balance >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                          {formatCurrency(p.current_balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleOutstanding.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                        Total ({visibleOutstanding.length} {outTab === 'all' ? 'parties' : outTab === 'customer' ? 'customers' : 'suppliers'})
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">{formatCurrency(outstandingTotals.opening)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-credit-green">{formatCurrency(outstandingTotals.credits)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-debit-red">{formatCurrency(outstandingTotals.debits)}</td>
                      <td className={`px-4 py-2.5 text-right text-sm font-bold ${outstandingTotals.balance >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                        {formatCurrency(outstandingTotals.balance)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════ STATEMENT OF ACCOUNT ══════════════════════════════════════════ */}
      {tab === 'statement' && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">

          {/* Filter card */}
          <div className="card p-4 flex flex-col gap-4 shrink-0">
            {/* Row 1: party autocomplete + generate */}
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-sm">
                <label className="label">Party</label>
                <PartyAutocomplete
                  parties={parties}
                  value={selectedParty ? parseInt(selectedParty) : ''}
                  onChange={(id) => {
                    setSelectedParty(id);
                    setStatement(null);
                    hasFetchedRef.current = false;
                  }}
                  placeholder="Search for customer or supplier…"
                />
              </div>
              <button
                onClick={fetchStatement}
                disabled={stmtLoading || !selectedParty}
                className="btn-primary gap-2 shrink-0"
              >
                <FunnelIcon className="h-4 w-4" />
                {stmtLoading ? 'Loading…' : 'Generate'}
              </button>
            </div>

            {/* Row 2: date preset pills */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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

              {activePreset === 'custom' ? (
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
              ) : (
                <span className="text-xs text-slate-400 sm:ml-auto">
                  {formatDate(range.from)} — {formatDate(range.to)}
                </span>
              )}
            </div>
          </div>

          {/* Empty state */}
          {!statement && !stmtLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <FunnelIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a party and click Generate to view the statement</p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {stmtLoading && (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          )}

          {/* Statement results */}
          {statement && !stmtLoading && (
            <div className="flex flex-col flex-1 min-h-0 gap-3">

              {/* Statement header + export */}
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {statement.party.name}
                    <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 capitalize align-middle">
                      {statement.party.type}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(range.from)} — {formatDate(range.to)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportStatementExcel} className="btn-secondary gap-2">
                    <ArrowDownTrayIcon className="h-4 w-4" />Excel
                  </button>
                  <button onClick={exportStatementPDF} className="btn-secondary gap-2">
                    <ArrowDownTrayIcon className="h-4 w-4" />PDF
                  </button>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="card text-center py-3">
                  <p className="text-xs text-slate-500">Opening</p>
                  <p className="text-base font-bold text-slate-800">{formatCurrency(statement.balance.opening_balance)}</p>
                </div>
                <div className="card text-center py-3">
                  <p className="text-xs text-slate-500">Credits</p>
                  <p className="text-base font-bold text-credit-green">{formatCurrency(statement.balance.total_credit)}</p>
                </div>
                <div className="card text-center py-3">
                  <p className="text-xs text-slate-500">Debits</p>
                  <p className="text-base font-bold text-debit-red">{formatCurrency(statement.balance.total_debit)}</p>
                </div>
                <div className="card text-center py-3">
                  <p className="text-xs text-slate-500">Balance</p>
                  <p className={`text-base font-bold ${statement.balance.current_balance >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                    {formatCurrency(statement.balance.current_balance)}
                  </p>
                </div>
              </div>

              {/* Scrollable transactions table */}
              <div className="card p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                  <h2 className="text-sm font-semibold text-slate-700">Transactions</h2>
                  <span className="text-xs text-slate-400">
                    {statement.transactions.length} record{statement.transactions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-y-auto overflow-x-auto flex-1">
                  <table className="w-full text-sm table-zebra">
                    <thead className="sticky top-0 z-10 bg-white">
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
                      {statement.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                            No transactions in this period
                          </td>
                        </tr>
                      ) : (
                        statement.transactions.map((txn) => (
                          <tr key={txn.id} className="border-b border-slate-100">
                            <td className="px-4 py-2 text-slate-600">{formatDate(txn.date)}</td>
                            <td className="px-4 py-2 font-mono text-xs text-slate-600">{txn.receipt_number || '—'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={txn.type === 'credit' ? 'badge-credit' : 'badge-debit'}>
                                {txn.type.toUpperCase()}
                              </span>
                            </td>
                            <td className={`px-4 py-2 text-right font-medium ${txn.type === 'credit' ? 'text-credit-green' : 'text-debit-red'}`}>
                              {formatCurrency(txn.amount)}
                            </td>
                            <td className={`px-4 py-2 text-right font-medium ${txn.balance_after >= 0 ? 'text-credit-green' : 'text-debit-red'}`}>
                              {formatCurrency(txn.balance_after)}
                            </td>
                            <td className="px-4 py-2 text-slate-500">{txn.reference || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
