import { useState, useEffect } from 'react';
import { getCustomPassword, setCustomPassword } from '../../utils/auth';
import { expenseApi, transactionCategoryApi } from '../../api';
import toast from 'react-hot-toast';
import ImportContactsModal from './ImportContactsModal';
import UsersSettings from './UsersSettings';
import {
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  UsersIcon,
  CommandLineIcon,
  BanknotesIcon,
  CheckIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const NAV_ITEMS = [
  { id: 'general', label: 'General', icon: Cog6ToothIcon, hint: 'Contacts, categories & security' },
  { id: 'users', label: 'Users', icon: UsersIcon, hint: 'Manage staff logins' },
  { id: 'shortcuts', label: 'Shortcuts', icon: CommandLineIcon, hint: 'Keyboard reference' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  // Password
  const [customPassword, setCustomPasswordState] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);

  // Categories
  const [expenseModuleEnabled, setExpenseModuleEnabled] = useState(false);
  const [categories, setCategories] = useState([]);
  const [txnCategories, setTxnCategories] = useState([]);

  const [importContactsOpen, setImportContactsOpen] = useState(false);

  useEffect(() => {
    getCustomPassword().then((saved) => saved && setCustomPasswordState(saved));
    fetchTxnCategories();
    expenseApi
      .isEnabled()
      .then((res) => {
        const val = res.data?.value;
        const enabled = val === true || val === 'true';
        setExpenseModuleEnabled(enabled);
        if (enabled) fetchCategories();
      })
      .catch(() => {});
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await expenseApi.getCategories();
      setCategories(res.data || []);
    } catch {
      toast.error('Failed to load expense categories');
    }
  };

  const fetchTxnCategories = async () => {
    try {
      const res = await transactionCategoryApi.getAll();
      setTxnCategories(res.data || []);
    } catch {
      // silent — table may not exist yet on first run
    }
  };

  // ── Password ────────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    try {
      await setCustomPassword(customPassword);
      toast.success('Custom password saved');
    } catch {
      toast.error('Failed to save password');
    }
  };

  const handleClearPassword = async () => {
    try {
      setCustomPasswordState('');
      await setCustomPassword('');
      toast.success('Custom password cleared');
    } catch {
      toast.error('Failed to clear password');
    }
  };

  return (
    <div className="max-w-6xl settings-compact">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage contacts, categories, security, users and shortcuts.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[224px_1fr] mt-6 items-start">
        {/* Side navigation */}
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible lg:sticky lg:top-4 pb-1 lg:pb-0">
          {NAV_ITEMS.map(({ id, label, icon: Icon, hint }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left whitespace-nowrap transition-colors lg:w-full ${
                  active ? 'bg-trust-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{label}</span>
                  <span className={`hidden lg:block text-[11px] leading-tight ${active ? 'text-blue-100' : 'text-slate-400'}`}>{hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="space-y-6 min-w-0">
          {activeTab === 'general' && (
            <div className="grid gap-6 xl:grid-cols-2 items-start">
              {/* Import Contacts */}
              <section className="card">
                <SectionHeader
                  icon={ArrowUpTrayIcon}
                  iconClass="text-trust-blue"
                  title="Import Contacts"
                  description="Import contacts from a .vcf (vCard) file and create them as Customer ledgers. You choose exactly which contacts to import."
                />
                <button onClick={() => setImportContactsOpen(true)} className="btn-primary text-sm gap-2 mt-1">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Import from .vcf file
                </button>
              </section>

              {/* Transaction Categories */}
              <CategoryManager
                icon={TagIcon}
                iconClass="text-trust-blue"
                title="Transaction Categories"
                description="Organise payments and receipts (e.g. Cash, Cheque, Online Transfer, UPI)."
                placeholder="e.g. Cash, Cheque, UPI"
                items={txnCategories}
                emptyText="No transaction categories yet"
                deleteWarning="Transactions using it will become uncategorised."
                onCreate={async (name) => {
                  await transactionCategoryApi.create(name);
                  await fetchTxnCategories();
                }}
                onUpdate={async (id, name) => {
                  await transactionCategoryApi.update(id, name);
                  await fetchTxnCategories();
                }}
                onDelete={async (id) => {
                  await transactionCategoryApi.delete(id);
                  await fetchTxnCategories();
                }}
              />

              {/* Expense Categories (conditional) */}
              {expenseModuleEnabled && (
                <CategoryManager
                  icon={BanknotesIcon}
                  iconClass="text-orange-500"
                  title="Expense Categories"
                  description="Organise your business expenses (e.g. Salary, Stationery, Utilities)."
                  placeholder="e.g. Salary, Postage, Rent"
                  items={categories}
                  emptyText="No categories yet"
                  deleteWarning="Expenses using it will become uncategorised."
                  onCreate={async (name) => {
                    await expenseApi.createCategory(name);
                    await fetchCategories();
                  }}
                  onUpdate={async (id, name) => {
                    await expenseApi.updateCategory(id, name);
                    await fetchCategories();
                  }}
                  onDelete={async (id) => {
                    await expenseApi.deleteCategory(id);
                    await fetchCategories();
                  }}
                />
              )}

              {/* Security */}
              <section className="card">
                <SectionHeader
                  icon={ShieldCheckIcon}
                  iconClass="text-slate-600"
                  title="Security"
                  description="Set an additional password that works alongside the default admin password."
                />
                <form onSubmit={(e) => { e.preventDefault(); handleSavePassword(); }} className="max-w-md">
                  <label className="label">Custom Password</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showCustomPassword ? 'text' : 'password'}
                        value={customPassword}
                        onChange={(e) => setCustomPasswordState(e.target.value)}
                        className="input-field pr-9"
                        placeholder="Enter custom password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showCustomPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="submit" disabled={!customPassword} className="btn-primary text-sm disabled:opacity-50">
                      Save Password
                    </button>
                    {customPassword && (
                      <button type="button" onClick={handleClearPassword} className="btn-secondary text-sm">
                        Clear
                      </button>
                    )}
                  </div>
                </form>
              </section>
            </div>
          )}

          {activeTab === 'users' && <UsersSettings />}

          {activeTab === 'shortcuts' && <ShortcutsSettings />}
        </div>
      </div>

      <ImportContactsModal open={importContactsOpen} onClose={() => setImportContactsOpen(false)} />
    </div>
  );
}

// ── Reusable section header ──────────────────────────────────────────────
function SectionHeader({ icon: Icon, iconClass, title, description }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {description && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{description}</p>}
    </div>
  );
}

// ── Reusable category manager (add / edit / delete with inline confirm) ──
function CategoryManager({
  icon,
  iconClass,
  title,
  description,
  placeholder,
  items,
  emptyText,
  deleteWarning,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // { id, name }
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      await onCreate(name.trim());
      setName('');
      toast.success('Category created');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = async (e) => {
    e.preventDefault();
    if (!editing?.name.trim()) return;
    try {
      setBusyId(editing.id);
      await onUpdate(editing.id, editing.name.trim());
      setEditing(null);
      toast.success('Category updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    try {
      setBusyId(id);
      await onDelete(id);
      setConfirmId(null);
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const Icon = icon;

  return (
    <section className="card">
      <SectionHeader icon={Icon} iconClass={iconClass} title={title} description={description} />

      {/* Add */}
      <form onSubmit={create} className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <label className="label">New Category</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            placeholder={placeholder}
          />
        </div>
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary text-sm gap-1 whitespace-nowrap disabled:opacity-50">
          <PlusIcon className="h-4 w-4" />
          Add
        </button>
      </form>

      {/* List */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6 rounded-lg border border-dashed border-slate-200">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
          {items.map((cat) => (
            <li key={cat.id} className="flex items-center gap-3 px-3 py-2.5 bg-white">
              {editing?.id === cat.id ? (
                <form onSubmit={update} className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                    className="input-field flex-1"
                    autoFocus
                  />
                  <button type="submit" disabled={busyId === cat.id} className="btn-primary text-xs gap-1">
                    <CheckIcon className="h-3.5 w-3.5" />
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancel</button>
                </form>
              ) : confirmId === cat.id ? (
                <div className="flex items-center gap-3 flex-1">
                  <span className="flex-1 text-sm text-red-600">Delete <strong>{cat.name}</strong>? {deleteWarning}</span>
                  <button onClick={() => remove(cat.id)} disabled={busyId === cat.id} className="btn-danger text-xs">
                    {busyId === cat.id ? 'Deleting…' : 'Delete'}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="btn-secondary text-xs">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-800">{cat.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing({ id: cat.id, name: cat.name })}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmId(cat.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Keyboard Shortcuts reference ─────────────────────────────────────────
const SHORTCUT_GROUPS = [
  {
    title: 'Global',
    hint: 'Available anywhere in the app',
    items: [
      { keys: ['Ctrl', 'F'], desc: 'Open the global finder / search' },
      { keys: ['Ctrl', 'B'], desc: 'Show or hide the sidebar' },
      { keys: ['Esc'], desc: 'Go back to the previous page' },
    ],
  },
  {
    title: 'Item Sales Entry',
    hint: 'On the item sales entry screen',
    items: [
      { keys: ['F2'], desc: 'Switch between sale counters (multi-counter mode)' },
      { keys: ['F10'], desc: 'Open the Sales Report' },
      { keys: ['Ctrl', 'I'], desc: 'Open the sales settings panel' },
    ],
  },
  {
    title: 'Item Purchase Entry',
    hint: 'On the item purchase entry screen',
    items: [
      { keys: ['F10'], desc: 'Open the Purchase Report' },
    ],
  },
  {
    title: 'Payments & Receipts',
    hint: 'On the payment / receipt entry screen',
    items: [
      { keys: ['F10'], desc: 'Open the matching Payment / Receipt Report' },
    ],
  },
];

function Kbd({ children }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutsSettings() {
  return (
    <section className="card">
      <SectionHeader
        icon={CommandLineIcon}
        iconClass="text-trust-blue"
        title="Keyboard Shortcuts"
        description="Speed up common actions with these shortcuts."
      />
      <div className="space-y-6">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
            <p className="text-xs text-slate-400 mb-2">{group.hint}</p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {group.items.map((item) => (
                <div key={item.desc} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="text-sm text-slate-600">{item.desc}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k, i) => (
                      <span key={k} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs text-slate-400">+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
