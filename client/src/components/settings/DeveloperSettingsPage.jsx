import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi, ledgerTypeApi } from '../../api';
import { isDevAuthenticated, devLogin, devLogout, getDevPassword } from '../../utils/auth';
import { getReceiptLayout, saveReceiptLayout, DEFAULT_RECEIPT_LAYOUT } from '../../utils/receiptLayout';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhotoIcon,
  TrashIcon,
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  FolderOpenIcon,
  CircleStackIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function DeveloperSettingsPage() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(isDevAuthenticated());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const passwordInputRef = useRef(null);

  // Store profile state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    store_name: '',
    address: '',
    gst_tax_id: '',
    phone: '',
    email: '',
    logo_path: '',
  });

  // Logo state
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  // Receipt layout state
  const [layout, setLayout] = useState(getReceiptLayout());
  const [dragItem, setDragItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState('profile');

  // Interest module state
  const [interestModuleEnabled, setInterestModuleEnabled] = useState(false);
  // Expense module state
  const [expenseModuleEnabled, setExpenseModuleEnabled] = useState(false);

  // Backup state
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupDir, setBackupDir] = useState('');
  const [backupDirInput, setBackupDirInput] = useState('');
  const [savingBackup, setSavingBackup] = useState(false);
  const [backingUpNow, setBackingUpNow] = useState(false);
  const [todayBackupExists, setTodayBackupExists] = useState(false);

  // Ledger types state
  const [ledgerTypes, setLedgerTypes] = useState([]);
  const [ltForm, setLtForm] = useState({ name: '', behaviour: 'customer' });
  const [ltSaving, setLtSaving] = useState(false);
  const [editingType, setEditingType] = useState(null);

  useEffect(() => {
    if (authenticated) {
      fetchSettings();
      fetchLedgerTypes();
    } else {
      setLoading(false);
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [authenticated]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getAll();
      const data = res.data;
      setProfile({
        store_name: data.store_name || '',
        address: data.address || '',
        gst_tax_id: data.gst_tax_id || '',
        phone: data.phone || '',
        email: data.email || '',
        logo_path: data.logo_path || '',
      });
      if (data.logo_path) {
        setLogoPreview(`/api/settings/logo-file?t=${Date.now()}`);
      }
      // Load interest module setting
      setInterestModuleEnabled(data.interest_module_enabled === true || data.interest_module_enabled === 'true');
      // Load expense module setting
      setExpenseModuleEnabled(data.expense_module_enabled === true || data.expense_module_enabled === 'true');
      // Load backup settings
      try {
        const bRes = await settingsApi.getBackupStatus();
        const bd = bRes.data;
        setBackupEnabled(bd.enabled);
        setBackupDir(bd.dir || '');
        setBackupDirInput(bd.dir || '');
        setTodayBackupExists(bd.todayBackupExists || false);
      } catch (_) { /* backup status is non-critical */ }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgerTypes = async () => {
    try {
      const res = await ledgerTypeApi.getAll();
      setLedgerTypes(res.data || []);
    } catch (err) {
      toast.error('Failed to load ledger types');
    }
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!ltForm.name.trim()) return toast.error('Name is required');
    try {
      setLtSaving(true);
      await ledgerTypeApi.create({ name: ltForm.name.trim(), behaviour: ltForm.behaviour });
      toast.success('Ledger type created');
      setLtForm({ name: '', behaviour: 'customer' });
      fetchLedgerTypes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLtSaving(false);
    }
  };

  const handleUpdateType = async (e) => {
    e.preventDefault();
    if (!editingType || !editingType.name.trim()) return;
    try {
      setLtSaving(true);
      await ledgerTypeApi.update(editingType.id, { name: editingType.name.trim(), behaviour: editingType.behaviour });
      toast.success('Ledger type updated');
      setEditingType(null);
      fetchLedgerTypes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLtSaving(false);
    }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Delete this ledger type? Ledgers using it must be reassigned first.')) return;
    try {
      await ledgerTypeApi.delete(id);
      toast.success('Ledger type deleted');
      fetchLedgerTypes();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (devLogin(password)) {
      setAuthenticated(true);
      setAuthError('');
      setPassword('');
    } else {
      setAuthError('Invalid developer password');
    }
  };

  const handleLogoutDev = () => {
    devLogout();
    setAuthenticated(false);
    navigate('/');
  };

  // --- Store Profile ---
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await settingsApi.updateBatch(profile);
      toast.success('Store profile saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Logo Upload ---
  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setUploadingLogo(true);
        const base64 = reader.result;
        await settingsApi.uploadLogo(base64);
        setLogoPreview(`/api/settings/logo-file?t=${Date.now()}`);
        setProfile((p) => ({ ...p, logo_path: 'uploaded' }));
        toast.success('Logo uploaded');
      } catch (err) {
        toast.error('Failed to upload logo');
      } finally {
        setUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = async () => {
    try {
      await settingsApi.deleteLogo();
      setLogoPreview(null);
      setProfile((p) => ({ ...p, logo_path: '' }));
      if (logoInputRef.current) logoInputRef.current.value = '';
      toast.success('Logo removed');
    } catch (err) {
      toast.error('Failed to remove logo');
    }
  };

  // --- Layout Editor ---
  const sortedElements = [...layout.elements].sort((a, b) => a.order - b.order);

  const handleDragStart = (idx) => {
    setDragItem(idx);
  };

  const handleDragEnter = (idx) => {
    setDragOverItem(idx);
  };

  const handleDragEnd = () => {
    if (dragItem === null || dragOverItem === null || dragItem === dragOverItem) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const items = [...sortedElements];
    const draggedItem = items[dragItem];
    items.splice(dragItem, 1);
    items.splice(dragOverItem, 0, draggedItem);
    const reordered = items.map((el, i) => ({ ...el, order: i }));
    setLayout((prev) => ({ ...prev, elements: reordered }));
    setDragItem(null);
    setDragOverItem(null);
  };

  const moveElement = (idx, direction) => {
    const items = [...sortedElements];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
    const reordered = items.map((el, i) => ({ ...el, order: i }));
    setLayout((prev) => ({ ...prev, elements: reordered }));
  };

  const toggleElement = (id) => {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, enabled: !el.enabled } : el
      ),
    }));
  };

  const handleSaveLayout = () => {
    saveReceiptLayout(layout);
    toast.success('Receipt layout saved');
  };

  const handleResetLayout = () => {
    const defaultLayout = JSON.parse(JSON.stringify(DEFAULT_RECEIPT_LAYOUT));
    setLayout(defaultLayout);
    saveReceiptLayout(defaultLayout);
    toast.success('Receipt layout reset to defaults');
  };

  const handleStyleChange = (key, value) => {
    setLayout((prev) => ({
      ...prev,
      style: { ...prev.style, [key]: value },
    }));
  };

  // --- Auth Gate ---
  if (!authenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="card p-8">
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <LockClosedIcon className="h-7 w-7 text-slate-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Developer Settings</h2>
              <p className="text-xs text-slate-500 mt-1">Enter developer password to continue</p>
            </div>
            <form onSubmit={handleAuth}>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                  className="input-field pr-10 text-center font-mono"
                  placeholder="Developer password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {authError && (
                <p className="text-xs text-debit-red mt-2 text-center">{authError}</p>
              )}
              <button type="submit" className="btn-primary w-full mt-4">
                Unlock
              </button>
            </form>
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary w-full mt-2 text-sm"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  // --- Backup ---
  const handleSaveBackupSettings = async () => {
    try {
      setSavingBackup(true);
      await settingsApi.updateBatch({
        backup_enabled: String(backupEnabled),
        backup_dir: backupDirInput.trim(),
      });
      setBackupDir(backupDirInput.trim());
      toast.success('Backup settings saved');
      // Refresh status
      const bRes = await settingsApi.getBackupStatus();
      setTodayBackupExists(bRes.data.todayBackupExists || false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingBackup(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      setBackingUpNow(true);
      const res = await settingsApi.backupNow();
      toast.success(`Backup created: ${res.data.path}`);
      setTodayBackupExists(true);
    } catch (err) {
      toast.error(err.message || 'Backup failed');
    } finally {
      setBackingUpNow(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Store Profile' },
    { id: 'ledgerTypes', label: 'Ledger Types' },
    { id: 'modules', label: 'Modules' },
    { id: 'backup', label: 'Backup' },
    { id: 'layout', label: 'Receipt Layout' },
    { id: 'style', label: 'Receipt Style' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">Developer Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Store profile, logo, and receipt configuration</p>
          </div>
        </div>
        <button onClick={handleLogoutDev} className="btn-secondary text-xs gap-1">
          <LockClosedIcon className="h-3.5 w-3.5" />
          Lock
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Store Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Logo Upload */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Shop Logo</h2>
            <div className="flex items-start gap-6">
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <PhotoIcon className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="space-y-3 flex-1">
                <p className="text-xs text-slate-500">Upload your shop logo (PNG, JPEG, SVG). Max 2MB. Will appear on printed receipts.</p>
                <div className="flex gap-2">
                  <label className="btn-primary text-sm cursor-pointer">
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </label>
                  {logoPreview && (
                    <button onClick={handleDeleteLogo} className="btn-secondary text-sm gap-1">
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Store Details */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Store Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Store Name</label>
                <input
                  type="text"
                  value={profile.store_name}
                  onChange={(e) => setProfile((p) => ({ ...p, store_name: e.target.value }))}
                  className="input-field"
                  placeholder="Your store name"
                />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea
                  value={profile.address}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Store address"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                    className="input-field"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    className="input-field"
                    placeholder="Email address"
                  />
                </div>
              </div>
              <div>
                <label className="label">GST / Tax ID</label>
                <input
                  type="text"
                  value={profile.gst_tax_id}
                  onChange={(e) => setProfile((p) => ({ ...p, gst_tax_id: e.target.value }))}
                  className="input-field"
                  placeholder="GST number"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Types Tab */}
      {activeTab === 'ledgerTypes' && (
        <div className="space-y-4">
          {/* Create New Type */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Create Ledger Type</h2>
            <form onSubmit={handleCreateType} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="label">Name</label>
                <input
                  type="text"
                  value={ltForm.name}
                  onChange={(e) => setLtForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Vendor, Distributor"
                />
              </div>
              <div className="w-44">
                <label className="label">Behaviour</label>
                <select
                  value={ltForm.behaviour}
                  onChange={(e) => setLtForm((f) => ({ ...f, behaviour: e.target.value }))}
                  className="input-field"
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              <button type="submit" disabled={ltSaving} className="btn-primary text-sm gap-1 whitespace-nowrap">
                <PlusIcon className="h-4 w-4" />
                Add Type
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-3">
              <strong>Customer behaviour:</strong> Payment increases balance, Receipt decreases.{' '}
              <strong>Supplier behaviour:</strong> Payment decreases balance, Receipt increases.
            </p>
          </div>

          {/* Existing Types */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Ledger Types</h2>
            <div className="space-y-2">
              {ledgerTypes.map((lt) => (
                <div key={lt.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                  {editingType?.id === lt.id ? (
                    <form onSubmit={handleUpdateType} className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={editingType.name}
                        onChange={(e) => setEditingType((p) => ({ ...p, name: e.target.value }))}
                        className="input-field flex-1"
                        autoFocus
                      />
                      <select
                        value={editingType.behaviour}
                        onChange={(e) => setEditingType((p) => ({ ...p, behaviour: e.target.value }))}
                        className="input-field w-36"
                      >
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                      </select>
                      <button type="submit" disabled={ltSaving} className="btn-primary text-xs">Save</button>
                      <button type="button" onClick={() => setEditingType(null)} className="btn-secondary text-xs">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-slate-800">{lt.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        lt.behaviour === 'customer'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}>
                        {lt.behaviour}
                      </span>
                      {lt.is_system ? (
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">SYSTEM</span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingType({ id: lt.id, name: lt.name, behaviour: lt.behaviour })}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteType(lt.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {ledgerTypes.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No ledger types found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Feature Modules</h2>
            <p className="text-xs text-slate-500 mb-6">Enable or disable optional feature modules. Changes take effect immediately.</p>

            <div className="space-y-4">
              {/* Interest Module Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">Interest Module</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enable interest-based payments for parties. Adds interest rate and scheme fields to
                    customer/supplier creation and tracks daily/monthly interest on outstanding balances.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={interestModuleEnabled}
                    onChange={async (e) => {
                      const newVal = e.target.checked;
                      try {
                        await settingsApi.update('interest_module_enabled', String(newVal));
                        setInterestModuleEnabled(newVal);
                        toast.success(`Interest module ${newVal ? 'enabled' : 'disabled'}`);
                      } catch (err) {
                        toast.error(err.message);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>

              {/* Expense Module Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">Expense Module</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track business expenses like salary, stationery and utilities. Adds expense entry,
                    expense reports and expense summary to the dashboard.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={expenseModuleEnabled}
                    onChange={async (e) => {
                      const newVal = e.target.checked;
                      try {
                        await settingsApi.update('expense_module_enabled', String(newVal));
                        setExpenseModuleEnabled(newVal);
                        toast.success(`Expense module ${newVal ? 'enabled' : 'disabled'}`);
                      } catch (err) {
                        toast.error(err.message);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-1">
              <CircleStackIcon className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">Database Backup</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              When enabled, a backup of <code className="bg-slate-100 px-1 rounded">inventory.db</code> is automatically
              created in the specified directory after each write operation. The backup filename
              includes the current date (e.g. <code className="bg-slate-100 px-1 rounded">inventory_10-03-2026.db</code>),
              so only one backup is created per day.
            </p>

            <div className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Auto Backup</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Automatically back up the database on every write operation.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={backupEnabled}
                    onChange={(e) => setBackupEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>

              {/* Backup directory */}
              <div>
                <label className="label">Backup Directory</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FolderOpenIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={backupDirInput}
                      onChange={(e) => setBackupDirInput(e.target.value)}
                      className="input-field pl-9 font-mono text-sm"
                      placeholder="e.g. C:\Backups\Inventory"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">Enter the full path to an existing folder where backups should be saved.</p>
              </div>

              {/* Status badge */}
              {backupDir && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                  todayBackupExists
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                  {todayBackupExists
                    ? "Today's backup already exists in the backup directory."
                    : "Today's backup has not been created yet. It will be created on the next write operation, or use \"Backup Now\"."
                  }
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleBackupNow}
                  disabled={backingUpNow || !backupDir}
                  className="btn-secondary text-sm gap-2"
                  title={!backupDir ? 'Configure a backup directory first' : ''}
                >
                  <CircleStackIcon className="h-4 w-4" />
                  {backingUpNow ? 'Backing up...' : 'Backup Now'}
                </button>
                <button
                  onClick={handleSaveBackupSettings}
                  disabled={savingBackup}
                  className="btn-primary text-sm"
                >
                  {savingBackup ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Layout Tab */}
      {activeTab === 'layout' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Receipt Layout</h2>
                <p className="text-xs text-slate-500 mt-0.5">Drag to reorder, toggle to show/hide elements</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleResetLayout} className="btn-secondary text-xs gap-1">
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  Reset
                </button>
                <button onClick={handleSaveLayout} className="btn-primary text-xs">
                  Save Layout
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {sortedElements.map((el, idx) => (
                <div
                  key={el.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                    dragOverItem === idx
                      ? 'border-trust-blue bg-blue-50'
                      : el.enabled
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  {/* Drag handle */}
                  <div className="flex flex-col gap-0.5 text-slate-300">
                    <div className="w-4 flex flex-col gap-[2px]">
                      <span className="block w-full h-[2px] bg-current rounded"></span>
                      <span className="block w-full h-[2px] bg-current rounded"></span>
                      <span className="block w-full h-[2px] bg-current rounded"></span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={el.enabled}
                      onChange={() => toggleElement(el.id)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                  </label>

                  {/* Label */}
                  <span className={`flex-1 text-sm ${el.enabled ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {el.label}
                  </span>

                  {/* Type badge */}
                  {el.type === 'divider' && (
                    <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">DIVIDER</span>
                  )}

                  {/* Move buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveElement(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-400"
                    >
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveElement(idx, 1)}
                      disabled={idx === sortedElements.length - 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-400"
                    >
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Style Tab */}
      {activeTab === 'style' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Receipt Style</h2>
              <button onClick={handleSaveLayout} className="btn-primary text-xs">
                Save Style
              </button>
            </div>

            <div className="space-y-4">
              {/* Format */}
              <div>
                <label className="label">Receipt Format</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="a4"
                      checked={layout.style.format === 'a4'}
                      onChange={() => handleStyleChange('format', 'a4')}
                      className="h-4 w-4 text-trust-blue focus:ring-trust-blue"
                    />
                    <span className="text-sm text-slate-700">A4 Paper</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="thermal"
                      checked={layout.style.format === 'thermal'}
                      onChange={() => handleStyleChange('format', 'thermal')}
                      className="h-4 w-4 text-trust-blue focus:ring-trust-blue"
                    />
                    <span className="text-sm text-slate-700">Thermal (80mm)</span>
                  </label>
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="label">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={layout.style.primaryColor}
                    onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={layout.style.primaryColor}
                    onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                    className="input-field w-32 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Font Sizes */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Header Font Size</label>
                  <input
                    type="number"
                    value={layout.style.headerFontSize}
                    onChange={(e) => handleStyleChange('headerFontSize', parseInt(e.target.value) || 20)}
                    min="12"
                    max="36"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Body Font Size</label>
                  <input
                    type="number"
                    value={layout.style.bodyFontSize}
                    onChange={(e) => handleStyleChange('bodyFontSize', parseInt(e.target.value) || 13)}
                    min="9"
                    max="20"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Footer Font Size</label>
                  <input
                    type="number"
                    value={layout.style.footerFontSize}
                    onChange={(e) => handleStyleChange('footerFontSize', parseInt(e.target.value) || 10)}
                    min="8"
                    max="16"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Texts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Receipt Title</label>
                  <input
                    type="text"
                    value={layout.style.titleText}
                    onChange={(e) => handleStyleChange('titleText', e.target.value)}
                    className="input-field"
                    placeholder="PAYMENT RECEIPT"
                  />
                </div>
                <div>
                  <label className="label">Footer Text</label>
                  <input
                    type="text"
                    value={layout.style.footerText}
                    onChange={(e) => handleStyleChange('footerText', e.target.value)}
                    className="input-field"
                    placeholder="Thank you for your business!"
                  />
                </div>
              </div>

              {/* Border Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layout.style.showBorder}
                  onChange={(e) => handleStyleChange('showBorder', e.target.checked)}
                  className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue"
                />
                <span className="text-sm text-slate-700">Show receipt border</span>
              </label>

              {/* Font Family */}
              <div>
                <label className="label">Font Family</label>
                <select
                  value={layout.style.fontFamily}
                  onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                  className="input-field"
                >
                  <option value="'Segoe UI', system-ui, -apple-system, sans-serif">Segoe UI (Default)</option>
                  <option value="'Arial', sans-serif">Arial</option>
                  <option value="'Courier New', monospace">Courier New (Monospace)</option>
                  <option value="'Georgia', serif">Georgia (Serif)</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
