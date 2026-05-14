import { useState, useEffect, useRef, useCallback } from 'react';
import { expenseApi } from '../../api';
import { formatCurrency, formatDate, todayISO } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

/* ─── Inline category creation dropdown ─────────────────────────── */
function CategorySelect({ categories, value, onChange, onCategoryCreated, selectRef, onEnterKey, onCreatingChange }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const setCreatingState = (val) => {
    setCreating(val);
    onCreatingChange?.(val);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setSaving(true);
      const res = await expenseApi.createCategory(newName.trim());
      toast.success('Category created');
      await Promise.resolve(onCategoryCreated?.(res.data));
      onChange(res.data.id);
      setNewName('');
      setCreatingState(false);
      // move focus to the next field (amount) after category is created
      onEnterKey?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleCreate(); } }}
          className="input-field flex-1"
          placeholder="New category name"
          autoFocus
        />
        <button type="button" onClick={handleCreate} disabled={saving || !newName.trim()} className="px-2 py-1 rounded text-[11px] font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 transition-colors whitespace-nowrap">
          {saving ? '…' : 'Create'}
        </button>
        <button type="button" onClick={() => setCreatingState(false)} className="px-2 py-1 rounded text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        ref={selectRef}
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnterKey?.(); } }}
        className="input-field flex-1"
      >
        <option value="">— No category —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button type="button" onClick={() => setCreatingState(true)}
        className="flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
        title="Create new category"
      >
        <PlusIcon className="h-3 w-3" />
        New
      </button>
    </div>
  );
}

/* ─── Expense name autocomplete ──────────────────────────────────── */
function ExpenseNameInput({ value, onChange, inputRef, onEnterKey }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = async (e) => {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    if (val.trim().length >= 1) {
      try {
        const res = await expenseApi.getSuggestions(val);
        setSuggestions(res.data || []);
        setOpen((res.data || []).length > 0);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const handleSelect = (s) => {
    onChange(s);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, suggestions.length - 1);
        setActiveIndex(next);
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, 0);
        setActiveIndex(prev);
        listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0) {
          handleSelect(suggestions[activeIndex]);
        } else {
          setOpen(false);
          onEnterKey?.();
        }
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
    }
    if (e.key === 'Enter') { e.preventDefault(); setOpen(false); onEnterKey?.(); }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className="input-field w-full"
        placeholder="e.g. Office rent, Staff wages"
        autoComplete="off"
      />
      {open && (
        <ul ref={listRef} className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
          {suggestions.map((s, i) => (
            <li
              key={s}
              className={`px-3 py-2 cursor-pointer text-slate-700 ${i === activeIndex ? 'bg-orange-50 text-orange-700 font-medium' : 'hover:bg-slate-50'}`}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Expense Entry Form ─────────────────────────────────────────── */
function ExpenseForm({ categories, onCreated, onCategoryCreated }) {
  const [form, setForm] = useState({
    expense_name: '',
    expense_category_id: null,
    amount: '',
    date: todayISO(),
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);
  const categoryRef = useRef(null);
  const amountRef = useRef(null);
  const dateRef = useRef(null);
  const notesRef = useRef(null);
  const submitRef = useRef(null);
  const creatingCategoryRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.expense_name.trim()) { toast.error('Expense name is required'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      setSubmitting(true);
      await expenseApi.create({
        expense_name: form.expense_name.trim(),
        expense_category_id: form.expense_category_id || null,
        amount: parseFloat(form.amount),
        date: form.date,
        notes: form.notes.trim(),
      });
      toast.success('Expense recorded');
      setForm({ expense_name: '', expense_category_id: null, amount: '', date: todayISO(), notes: '' });
      nameRef.current?.focus();
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card py-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-[2] min-w-[160px]">
          <label className="label">Expense Name *</label>
          <ExpenseNameInput
            value={form.expense_name}
            onChange={(v) => setForm((p) => ({ ...p, expense_name: v }))}
            inputRef={nameRef}
            onEnterKey={() => categoryRef.current?.focus()}
          />
        </div>
        <div className="flex-[1.5] min-w-[180px]">
          <label className="label">Category</label>
          <CategorySelect
            categories={categories}
            value={form.expense_category_id}
            onChange={(v) => setForm((p) => ({ ...p, expense_category_id: v }))}
            onCategoryCreated={onCategoryCreated}
            selectRef={categoryRef}
            onEnterKey={() => amountRef.current?.focus()}
            onCreatingChange={(val) => { creatingCategoryRef.current = val; }}
          />
        </div>
        <div className="w-32 shrink-0">
          <label className="label">Amount *</label>
          <input
            ref={amountRef}
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dateRef.current?.focus(); } }}
            className="input-field"
            placeholder="0.00"
          />
        </div>
        <div className="w-36 shrink-0">
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
        <div className="flex-1 min-w-[120px]">
          <label className="label">Notes</label>
          <input
            ref={notesRef}
            type="text"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitRef.current?.click(); } }}
            className="input-field"
            placeholder="Optional"
          />
        </div>
        <div className="shrink-0">
          <button
            ref={submitRef}
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 transition-colors whitespace-nowrap"
          >
            {submitting ? 'Saving…' : 'Record Expense'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ─── Edit Expense Modal ─────────────────────────────────────────── */
export function EditExpenseModal({ expense, categories, open, onClose, onSaved, onCategoryCreated }) {
  const [form, setForm] = useState({
    expense_name: expense?.expense_name || '',
    expense_category_id: expense?.expense_category_id || null,
    amount: expense?.amount || '',
    date: expense?.date || todayISO(),
    notes: expense?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (expense) {
      setForm({
        expense_name: expense.expense_name,
        expense_category_id: expense.expense_category_id || null,
        amount: expense.amount,
        date: expense.date,
        notes: expense.notes || '',
      });
    }
  }, [expense]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.expense_name.trim()) { toast.error('Expense name is required'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      setSaving(true);
      await expenseApi.update(expense.id, {
        expense_name: form.expense_name.trim(),
        expense_category_id: form.expense_category_id || null,
        amount: parseFloat(form.amount),
        date: form.date,
        notes: form.notes.trim(),
      });
      toast.success('Expense updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Expense" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Expense Name *</label>
          <input
            type="text"
            value={form.expense_name}
            onChange={(e) => setForm((p) => ({ ...p, expense_name: e.target.value }))}
            className="input-field"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Category</label>
          <CategorySelect
            categories={categories}
            value={form.expense_category_id}
            onChange={(v) => setForm((p) => ({ ...p, expense_category_id: v }))}
            onCategoryCreated={async (cat) => {
              await onCategoryCreated(cat);
              setForm((p) => ({ ...p, expense_category_id: cat.id }));
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Amount *</label>
            <input
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className="input-field"
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function ExpensePage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fromDate: todayISO(), toDate: todayISO(), categoryId: '', expenseName: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, expense: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, expense: null });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate)   params.toDate   = filters.toDate;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.expenseName) params.expenseName = filters.expenseName;
      const [expRes, catRes] = await Promise.all([
        expenseApi.getAll(params),
        expenseApi.getCategories(),
      ]);
      setExpenses(expRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    try {
      await expenseApi.delete(deleteModal.expense.id);
      toast.success('Expense deleted');
      setDeleteModal({ open: false, expense: null });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCategoryCreated = async (cat) => {
    try {
      const catRes = await expenseApi.getCategories();
      setCategories(catRes.data || []);
    } catch {
      setCategories((prev) => {
        if (prev.find((c) => c.id === cat.id)) return prev;
        return [...prev, cat].sort((a, b) => a.name.localeCompare(b.name));
      });
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Record and track business expenses</p>
        </div>
        <button onClick={() => setShowFilters((v) => !v)} className="btn-secondary gap-2">
          <FunnelIcon className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Filter'}
        </button>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">From Date</label>
              <input type="date" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={filters.categoryId} onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))} className="input-field">
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Expense Name</label>
              <input type="text" value={filters.expenseName} onChange={(e) => setFilters((p) => ({ ...p, expenseName: e.target.value }))} className="input-field" placeholder="Search by name" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setFilters({ fromDate: todayISO(), toDate: todayISO(), categoryId: '', expenseName: '' })}
              className="btn-secondary text-xs"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Entry Form */}
      <ExpenseForm categories={categories} onCreated={fetchData} onCategoryCreated={handleCategoryCreated} />

      {/* Summary */}
      {expenses.length > 0 && (
        <div className="card py-3 px-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-semibold text-orange-700">
            Total: {formatCurrency(total)}
          </span>
        </div>
      )}

      {/* Expense List */}
      {loading ? (
        <LoadingSpinner className="py-12" size="lg" />
      ) : expenses.length === 0 ? (
        <EmptyState icon={BanknotesIcon} title="No expenses" description="Record an expense to get started" />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Expense Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Category</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Notes</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(exp.date)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{exp.expense_name}</td>
                    <td className="px-4 py-2.5">
                      {exp.category_name ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">
                          {exp.category_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-orange-700">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[180px] truncate">
                      {exp.notes || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditModal({ open: true, expense: exp })}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ open: true, expense: exp })}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
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

      {/* Edit Modal */}
      {editModal.expense && (
        <EditExpenseModal
          expense={editModal.expense}
          categories={categories}
          open={editModal.open}
          onClose={() => setEditModal({ open: false, expense: null })}
          onSaved={fetchData}
          onCategoryCreated={handleCategoryCreated}
        />
      )}

      {/* Delete Confirmation */}
      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, expense: null })} title="Delete Expense" size="sm">
        {deleteModal.expense && (
          <>
            <p className="text-sm text-slate-600 mb-6">
              Delete <strong>{deleteModal.expense.expense_name}</strong> ({formatCurrency(deleteModal.expense.amount)} on {formatDate(deleteModal.expense.date)})?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal({ open: false, expense: null })} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
