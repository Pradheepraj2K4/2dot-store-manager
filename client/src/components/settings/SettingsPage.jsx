import { useState, useEffect, useRef } from 'react';
import { getDefaultPassword, getCustomPassword, setCustomPassword } from '../../utils/auth';
import { expenseApi, transactionCategoryApi } from '../../api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import ImportContactsModal from './ImportContactsModal';
import UsersSettings from './UsersSettings';
import { LockClosedIcon, EyeIcon, EyeSlashIcon, PlusIcon, PencilIcon, TrashIcon, TagIcon, ArrowUpTrayIcon, Cog6ToothIcon, UsersIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [customPassword, setCustomPasswordState] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const passwordRef = useRef(null);

  // Expense categories
  const [expenseModuleEnabled, setExpenseModuleEnabled] = useState(false);
  const [categories, setCategories] = useState([]);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [deleteCatModal, setDeleteCatModal] = useState({ open: false, cat: null });

  // Transaction categories
  const [txnCategories, setTxnCategories] = useState([]);
  const [txnCatName, setTxnCatName] = useState('');
  const [txnCatSaving, setTxnCatSaving] = useState(false);
  const [editingTxnCat, setEditingTxnCat] = useState(null);
  const [deleteTxnCatModal, setDeleteTxnCatModal] = useState({ open: false, cat: null });

  useEffect(() => {
    getCustomPassword().then((saved) => {
      if (saved) setCustomPasswordState(saved);
    });
  }, []);

  useEffect(() => {
    expenseApi.isEnabled().then((res) => {
      const val = res.data?.value;
      const enabled = val === true || val === 'true';
      setExpenseModuleEnabled(enabled);
      if (enabled) fetchCategories();
    }).catch(() => {});
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await expenseApi.getCategories();
      setCategories(res.data || []);
    } catch {
      toast.error('Failed to load expense categories');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      setCatSaving(true);
      const res = await expenseApi.createCategory(catName.trim());
      setCatName('');
      toast.success('Category created');
      if (res?.data) {
        setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      await fetchCategories();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCatSaving(false);
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCat || !editingCat.name.trim()) return;
    try {
      setCatSaving(true);
      await expenseApi.updateCategory(editingCat.id, editingCat.name.trim());
      setEditingCat(null);
      toast.success('Category updated');
      fetchCategories();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    const id = deleteCatModal.cat?.id;
    if (!id) return;
    try {
      await expenseApi.deleteCategory(id);
      toast.success('Category deleted');
      setDeleteCatModal({ open: false, cat: null });
      fetchCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSavePassword = async () => {
    try {
      await setCustomPassword(customPassword);
      toast.success('Custom password saved');
    } catch (err) {
      toast.error('Failed to save password');
    }
  };

  // ── Transaction categories ───────────────────────────────────────────
  useEffect(() => {
    fetchTxnCategories();
  }, []);

  const fetchTxnCategories = async () => {
    try {
      const res = await transactionCategoryApi.getAll();
      setTxnCategories(res.data || []);
    } catch {
      // silent — table may not exist yet on first run
    }
  };

  const handleCreateTxnCategory = async (e) => {
    e.preventDefault();
    if (!txnCatName.trim()) return;
    try {
      setTxnCatSaving(true);
      await transactionCategoryApi.create(txnCatName.trim());
      setTxnCatName('');
      toast.success('Category created');
      await fetchTxnCategories();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTxnCatSaving(false);
    }
  };

  const handleUpdateTxnCategory = async (e) => {
    e.preventDefault();
    if (!editingTxnCat || !editingTxnCat.name.trim()) return;
    try {
      setTxnCatSaving(true);
      await transactionCategoryApi.update(editingTxnCat.id, editingTxnCat.name.trim());
      setEditingTxnCat(null);
      toast.success('Category updated');
      fetchTxnCategories();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTxnCatSaving(false);
    }
  };

  const handleDeleteTxnCategory = async () => {
    const id = deleteTxnCatModal.cat?.id;
    if (!id) return;
    try {
      await transactionCategoryApi.delete(id);
      toast.success('Category deleted');
      setDeleteTxnCatModal({ open: false, cat: null });
      fetchTxnCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleClearPassword = async () => {
    try {
      setCustomPasswordState('');
      await setCustomPassword('');
      toast.success('Custom password cleared');
    } catch (err) {
      toast.error('Failed to clear password');
    }
  };

  const [importContactsOpen, setImportContactsOpen] = useState(false);

  return (
    <div className="space-y-3 max-w-3xl settings-compact">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage application settings</p>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'general' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Cog6ToothIcon className="h-4 w-4" />
          General
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Users
        </button>
      </div>

      {activeTab === 'users' && <UsersSettings />}

      {activeTab === 'general' && (
      <>      {/* ── Import Contacts ───────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <ArrowUpTrayIcon className="h-5 w-5 text-trust-blue" />
          <h2 className="text-base font-semibold text-slate-900">Import Contacts</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Import contacts from a <strong>.vcf</strong> (vCard) file and create them as <strong>Customer</strong> ledgers.
          You can pick exactly which contacts to import from the file.
        </p>
        <button
          onClick={() => setImportContactsOpen(true)}
          className="btn-primary text-sm gap-2"
        >
          <ArrowUpTrayIcon className="h-4 w-4" />
          Import from .vcf file
        </button>
      </div>


      {/* Expense Categories (only shown when expense module is enabled) */}
      {expenseModuleEnabled && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <h2 className="text-base font-semibold text-slate-900">Expense Categories</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Create categories to organise your business expenses (e.g. Salary, Stationery, Utilities).</p>

          {/* Add Category */}
          <form onSubmit={handleCreateCategory} className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="label">New Category Name</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="input-field"
                placeholder="e.g. Salary, Postage, Rent"
              />
            </div>
            <button type="submit" disabled={catSaving || !catName.trim()} className="btn-primary text-sm gap-1 whitespace-nowrap">
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </form>

          {/* Category List */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                {editingCat?.id === cat.id ? (
                  <form onSubmit={handleUpdateCategory} className="flex items-center gap-3 flex-1">
                    <input
                      type="text"
                      value={editingCat.name}
                      onChange={(e) => setEditingCat((p) => ({ ...p, name: e.target.value }))}
                      className="input-field flex-1"
                      autoFocus
                    />
                    <button type="submit" disabled={catSaving} className="btn-primary text-xs">Save</button>
                    <button type="button" onClick={() => setEditingCat(null)} className="btn-secondary text-xs">Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-800">{cat.name}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingCat({ id: cat.id, name: cat.name })}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteCatModal({ open: true, cat })}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No categories yet</p>
            )}
          </div>
        </div>
      )}

      {/* Transaction Categories (always shown) */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TagIcon className="h-5 w-5 text-trust-blue" />
          <h2 className="text-base font-semibold text-slate-900">Transaction Categories</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">Create categories to organise payments and receipts (e.g. Cash, Cheque, Online Transfer, UPI).</p>

        {/* Add Transaction Category */}
        <form onSubmit={handleCreateTxnCategory} className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="label">New Category Name</label>
            <input
              type="text"
              value={txnCatName}
              onChange={(e) => setTxnCatName(e.target.value)}
              className="input-field"
              placeholder="e.g. Cash, Cheque, UPI"
            />
          </div>
          <button type="submit" disabled={txnCatSaving || !txnCatName.trim()} className="btn-primary text-sm gap-1 whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </form>

        {/* Transaction Category List */}
        <div className="space-y-2">
          {txnCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              {editingTxnCat?.id === cat.id ? (
                <form onSubmit={handleUpdateTxnCategory} className="flex items-center gap-3 flex-1">
                  <input
                    type="text"
                    value={editingTxnCat.name}
                    onChange={(e) => setEditingTxnCat((p) => ({ ...p, name: e.target.value }))}
                    className="input-field flex-1"
                    autoFocus
                  />
                  <button type="submit" disabled={txnCatSaving} className="btn-primary text-xs">Save</button>
                  <button type="button" onClick={() => setEditingTxnCat(null)} className="btn-secondary text-xs">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-800">{cat.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingTxnCat({ id: cat.id, name: cat.name })}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTxnCatModal({ open: true, cat })}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {txnCategories.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No transaction categories yet</p>
          )}
        </div>
      </div>

      {/* Password Configurations */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <LockClosedIcon className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Password Configuration</h2>
        </div>
        <div className="space-y-4">
          {/* Custom Password */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Custom Password (Additional)</h3>
              <p className="text-xs text-slate-500 mt-1">Set an additional password that works alongside the default admin password</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSavePassword(); }}>
              <div className="flex items-center gap-2 mt-3">
                <input
                  ref={passwordRef}
                  type={showCustomPassword ? "text" : "password"}
                  value={customPassword}
                  onChange={(e) => setCustomPasswordState(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Enter custom password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomPassword(!showCustomPassword)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                >
                  {showCustomPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="submit"
                  disabled={!customPassword}
                  className="btn-primary text-sm"
                >
                  Save Custom Password
                </button>
                {customPassword && (
                  <button
                    type="button"
                    onClick={handleClearPassword}
                    className="btn-secondary text-sm"
                  >
                    Clear Password
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
      </>
      )}
      <Modal
        open={deleteCatModal.open}
        onClose={() => setDeleteCatModal({ open: false, cat: null })}
        title="Delete Category"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete <strong>{deleteCatModal.cat?.name}</strong>? Expenses using it will become uncategorised.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteCatModal({ open: false, cat: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDeleteCategory} className="btn-danger">Delete</button>
        </div>
      </Modal>
      <Modal
        open={deleteTxnCatModal.open}
        onClose={() => setDeleteTxnCatModal({ open: false, cat: null })}
        title="Delete Transaction Category"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Delete <strong>{deleteTxnCatModal.cat?.name}</strong>? Transactions using it will become uncategorised.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteTxnCatModal({ open: false, cat: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDeleteTxnCategory} className="btn-danger">Delete</button>
        </div>
      </Modal>
      <ImportContactsModal
        open={importContactsOpen}
        onClose={() => setImportContactsOpen(false)}
      />
    </div>
  );
}
