import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi, ledgerTypeApi, interestSchemeApi } from '../../api';
import { isDevAuthenticated, devLogin, devLogout, getDevPassword } from '../../utils/auth';
import { mergeReceiptConfig, cacheReceiptConfig, THERMAL_SECTION_LABELS, PAPER_COLUMN_LABELS } from '../../utils/receiptConfig';
import { SIDEBAR_MENU_GROUPS, SIDEBAR_MENU_LABELS_KEY } from '../../utils/sidebarMenus';
import { buildSaleReceiptHtml } from '../../utils/saleReceipt';
import { fetchLogoDataUrl } from '../../utils/interestReceipt';
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
  ExclamationTriangleIcon,
  QrCodeIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Compact toggle row for the Feature Modules section. Persists the setting and
// shows a toast; parent keeps the state.
function ModuleToggle({ label, settingKey, checked, onChange, toastLabel }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-white">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={async (e) => {
            const newVal = e.target.checked;
            try {
              await settingsApi.update(settingKey, String(newVal));
              onChange(newVal);
              toast.success(`${toastLabel} ${newVal ? 'enabled' : 'disabled'}`);
            } catch (err) {
              toast.error(err.message);
            }
          }}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
      </label>
    </div>
  );
}

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
    place: '',
    gst_tax_id: '',
    phone: '',
    email: '',
    upi_id: '',
    logo_path: '',
  });

  // Logo state
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const logoInputRef = useRef(null);

  // Receipt layout state
  // Receipt design editor state (structured thermal + free-hand A4/A5)
  const [thermalCfg, setThermalCfg] = useState(() => mergeReceiptConfig(null).thermal);
  const [paperCfg, setPaperCfg] = useState(() => mergeReceiptConfig(null).paper);
  const [paperPreviewFormat, setPaperPreviewFormat] = useState('a4');
  const [savingReceiptDesign, setSavingReceiptDesign] = useState(false);
  const [activeBlock, setActiveBlock] = useState('logo');
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const paperCanvasRef = useRef(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState('profile');
  const [receiptSubTab, setReceiptSubTab] = useState('print');

  // Interest module state
  const [interestModuleEnabled, setInterestModuleEnabled] = useState(false);
  // Expense module state
  const [expenseModuleEnabled, setExpenseModuleEnabled] = useState(false);
  // Service module state
  const [serviceModuleEnabled, setServiceModuleEnabled] = useState(false);
  // Restaurant module state
  const [restaurantModuleEnabled, setRestaurantModuleEnabled] = useState(false);
  const [multiCounterEnabled, setMultiCounterEnabled] = useState(false);
  // Purchase module state (default enabled)
  const [purchaseModuleEnabled, setPurchaseModuleEnabled] = useState(true);
  // Account transaction module state (default enabled)
  const [accountTransactionEnabled, setAccountTransactionEnabled] = useState(true);
  // GST fields state
  const [gstFieldsEnabled, setGstFieldsEnabled] = useState(false);
  // Cash tender field state (default enabled)
  const [cashTenderEnabled, setCashTenderEnabled] = useState(true);
  // Freight charge field state
  const [freightChargeEnabled, setFreightChargeEnabled] = useState(false);
  // PO number field state
  const [poNumberEnabled, setPoNumberEnabled] = useState(false);
  // IMEI tracking state
  const [imeiTrackingEnabled, setImeiTrackingEnabled] = useState(false);
  // Print receipt settings
  const [printReceiptsPaymentEnabled, setPrintReceiptsPaymentEnabled] = useState(false);
  const [printReceiptsInterestEnabled, setPrintReceiptsInterestEnabled] = useState(false);
  const [printReceiptsSaleEnabled, setPrintReceiptsSaleEnabled] = useState(false);
  // Default print format (thermal / a5 / a4) stored inside receipt_config
  const [receiptConfig, setReceiptConfig] = useState({});
  const [defaultPrintFormat, setDefaultPrintFormat] = useState('thermal');
  const [savingPrintFormat, setSavingPrintFormat] = useState(false);
  // Thermal receipt logo size (mm) — stored inside receipt_config.thermalLogoHeight
  const [thermalLogoHeight, setThermalLogoHeight] = useState(12);
  const [savingLogoHeight, setSavingLogoHeight] = useState(false);
  // Thermal receipt UPI QR size (mm) — stored inside receipt_config.thermalUpiQrSize
  const [thermalUpiQrSize, setThermalUpiQrSize] = useState(28);
  const [savingUpiQrSize, setSavingUpiQrSize] = useState(false);
  // Thermal paper/roll width (mm) — stored inside receipt_config.thermalWidth
  const [thermalWidth, setThermalWidth] = useState(80);
  const [savingThermalWidth, setSavingThermalWidth] = useState(false);
  // Logo as a data URL for the live thermal preview (embeds cleanly in srcDoc)
  const [previewLogoDataUrl, setPreviewLogoDataUrl] = useState(null);

  // Data tab state
  const [clearingData, setClearingData] = useState(false);
  const [resettingSettings, setResettingSettings] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [clearingTransactions, setClearingTransactions] = useState(false);
  const [confirmClearTransactions, setConfirmClearTransactions] = useState(false);

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

  // Interest schemes state
  const [schemes, setSchemes] = useState([]);
  const [schForm, setSchForm] = useState({ name: '', nature: 'MONTHLY' });
  const [schSaving, setSchSaving] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);

  // Sidebar menu labels state (custom names for sidebar menus)
  const [menuLabels, setMenuLabels] = useState({});
  const [savingMenuLabels, setSavingMenuLabels] = useState(false);

  useEffect(() => {
    if (authenticated) {
      fetchSettings();
      fetchLedgerTypes();
      fetchSchemes();
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
        place: data.place || '',
        gst_tax_id: data.gst_tax_id || '',
        phone: data.phone || '',
        email: data.email || '',
        upi_id: data.upi_id || '',
        logo_path: data.logo_path || '',
      });
      if (data.logo_path) {
        setLogoPreview(`/api/settings/logo-file?t=${Date.now()}`);
        fetchLogoDataUrl(`/api/settings/logo-file`).then(setPreviewLogoDataUrl).catch(() => {});
      }
      // Load interest module setting
      setInterestModuleEnabled(data.interest_module_enabled === true || data.interest_module_enabled === 'true');
      // Load expense module setting
      setExpenseModuleEnabled(data.expense_module_enabled === true || data.expense_module_enabled === 'true');
      // Load service module setting
      setServiceModuleEnabled(data.service_module_enabled === true || data.service_module_enabled === 'true');
      // Load restaurant module setting
      setRestaurantModuleEnabled(data.restaurant_module_enabled === true || data.restaurant_module_enabled === 'true');
      // Load purchase module setting (default enabled — missing key counts as on)
      setPurchaseModuleEnabled(data.purchase_module_enabled !== false && data.purchase_module_enabled !== 'false');
      // Load account transaction module setting (default enabled)
      setAccountTransactionEnabled(data.account_transaction_enabled !== false && data.account_transaction_enabled !== 'false');
      // Load multi-counter setting
      setMultiCounterEnabled(data.multi_counter_enabled === true || data.multi_counter_enabled === 'true');
      // Load GST fields setting
      setGstFieldsEnabled(data.gst_fields_enabled === true || data.gst_fields_enabled === 'true');
      // Load cash tender setting (default enabled — missing key counts as on)
      setCashTenderEnabled(data.cash_tender_enabled !== false && data.cash_tender_enabled !== 'false');
      // Load freight charge setting
      setFreightChargeEnabled(data.freight_charge_enabled === true || data.freight_charge_enabled === 'true');
      // Load PO number setting
      setPoNumberEnabled(data.po_number_enabled === true || data.po_number_enabled === 'true');
      // Load IMEI tracking setting
      setImeiTrackingEnabled(data.imei_tracking_enabled === true || data.imei_tracking_enabled === 'true');
      // Load custom sidebar menu labels
      setMenuLabels(data[SIDEBAR_MENU_LABELS_KEY] && typeof data[SIDEBAR_MENU_LABELS_KEY] === 'object' ? data[SIDEBAR_MENU_LABELS_KEY] : {});
      // Load print receipt settings
      setPrintReceiptsPaymentEnabled(data.print_receipts_payment_enabled === true || data.print_receipts_payment_enabled === 'true');
      setPrintReceiptsInterestEnabled(data.print_receipts_interest_enabled === true || data.print_receipts_interest_enabled === 'true');
      setPrintReceiptsSaleEnabled(data.print_receipts_sale_enabled === true || data.print_receipts_sale_enabled === 'true');
      // Load default print format from receipt_config
      const cfg = data.receipt_config && typeof data.receipt_config === 'object' ? data.receipt_config : {};
      setReceiptConfig(cfg);
      const mergedCfg = mergeReceiptConfig(cfg);
      setThermalCfg(mergedCfg.thermal);
      setPaperCfg(mergedCfg.paper);
      cacheReceiptConfig(mergedCfg);
      setDefaultPrintFormat(['thermal', 'a5', 'a4'].includes(cfg.format) ? cfg.format : 'thermal');
      const lh = Number(cfg.thermalLogoHeight);
      setThermalLogoHeight(Number.isFinite(lh) && lh > 0 ? Math.min(72, Math.max(6, lh)) : 12);
      const qs = Number(cfg.thermalUpiQrSize);
      setThermalUpiQrSize(Number.isFinite(qs) && qs > 0 ? Math.min(50, Math.max(15, qs)) : 28);
      const tw = Number(cfg.thermalWidth);
      setThermalWidth(Number.isFinite(tw) && tw > 0 ? Math.min(80, Math.max(50, tw)) : 80);
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

  const fetchSchemes = async () => {
    try {
      const res = await interestSchemeApi.getAll();
      setSchemes(res.data || []);
    } catch (err) {
      toast.error('Failed to load interest schemes');
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

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    if (!schForm.name.trim()) return toast.error('Name is required');
    try {
      setSchSaving(true);
      await interestSchemeApi.create({ name: schForm.name.trim(), nature: schForm.nature });
      toast.success('Interest scheme created');
      setSchForm({ name: '', nature: 'MONTHLY' });
      fetchSchemes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSchSaving(false);
    }
  };

  const handleUpdateScheme = async (e) => {
    e.preventDefault();
    if (!editingScheme || !editingScheme.name.trim()) return;
    try {
      setSchSaving(true);
      await interestSchemeApi.update(editingScheme.id, { name: editingScheme.name.trim(), nature: editingScheme.nature });
      toast.success('Interest scheme updated');
      setEditingScheme(null);
      fetchSchemes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSchSaving(false);
    }
  };

  const handleDeleteScheme = async (id) => {
    if (!window.confirm('Delete this interest scheme?')) return;
    try {
      await interestSchemeApi.delete(id);
      toast.success('Interest scheme deleted');
      fetchSchemes();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMenuLabelChange = (name, value) => {
    setMenuLabels((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveMenuLabels = async () => {
    try {
      setSavingMenuLabels(true);
      // Persist only non-empty custom labels; blank inputs fall back to defaults.
      const cleaned = {};
      for (const [name, label] of Object.entries(menuLabels)) {
        if (typeof label === 'string' && label.trim()) cleaned[name] = label.trim();
      }
      await settingsApi.update(SIDEBAR_MENU_LABELS_KEY, cleaned);
      setMenuLabels(cleaned);
      toast.success('Menu names saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingMenuLabels(false);
    }
  };

  const handleResetMenuLabels = async () => {
    if (!window.confirm('Reset all sidebar menu names to their defaults?')) return;
    try {
      setSavingMenuLabels(true);
      await settingsApi.update(SIDEBAR_MENU_LABELS_KEY, {});
      setMenuLabels({});
      toast.success('Menu names reset to defaults');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingMenuLabels(false);
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
  const processLogoFile = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(file.type)) {
      toast.error('Please choose a PNG, JPEG, GIF, WebP or SVG image');
      return;
    }
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
        setPreviewLogoDataUrl(base64);
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

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    await processLogoFile(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleLogoDrop = async (e) => {
    e.preventDefault();
    setLogoDragActive(false);
    if (uploadingLogo) return;
    const file = e.dataTransfer.files?.[0];
    await processLogoFile(file);
  };

  const handleDeleteLogo = async () => {
    try {
      await settingsApi.deleteLogo();
      setLogoPreview(null);
      setPreviewLogoDataUrl(null);
      setProfile((p) => ({ ...p, logo_path: '' }));
      if (logoInputRef.current) logoInputRef.current.value = '';
      toast.success('Logo removed');
    } catch (err) {
      toast.error('Failed to remove logo');
    }
  };

  // Persist the thermal logo height (mm) into receipt_config. Called when the
  // slider is released so we don't spam the API on every drag tick.
  const saveThermalLogoHeight = async (value) => {
    const clamped = Math.min(72, Math.max(6, Number(value) || 12));
    if ((receiptConfig.thermalLogoHeight || 12) === clamped) return;
    setSavingLogoHeight(true);
    try {
      const newCfg = { ...receiptConfig, thermalLogoHeight: clamped };
      await settingsApi.update('receipt_config', newCfg);
      setReceiptConfig(newCfg);
      toast.success(`Thermal logo size set to ${clamped}mm`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingLogoHeight(false);
    }
  };

  // Persist the thermal UPI QR size (mm) into receipt_config. Called when the
  // slider is released so we don't spam the API on every drag tick.
  const saveThermalUpiQrSize = async (value) => {
    const clamped = Math.min(50, Math.max(15, Number(value) || 28));
    if ((receiptConfig.thermalUpiQrSize || 28) === clamped) return;
    setSavingUpiQrSize(true);
    try {
      const newCfg = { ...receiptConfig, thermalUpiQrSize: clamped };
      await settingsApi.update('receipt_config', newCfg);
      setReceiptConfig(newCfg);
      toast.success(`UPI QR size set to ${clamped}mm`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingUpiQrSize(false);
    }
  };

  // Persist the thermal paper/roll width (mm) into receipt_config. Called when
  // the slider is released so we don't spam the API on every drag tick.
  const saveThermalWidth = async (value) => {
    const clamped = Math.min(80, Math.max(50, Number(value) || 80));
    if ((receiptConfig.thermalWidth || 80) === clamped) return;
    setSavingThermalWidth(true);
    try {
      const newCfg = { ...receiptConfig, thermalWidth: clamped };
      await settingsApi.update('receipt_config', newCfg);
      setReceiptConfig(newCfg);
      toast.success(`Thermal width set to ${clamped}mm`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingThermalWidth(false);
    }
  };

  // --- Receipt design editor (thermal structured + paper free-hand) ---

  // Persist the current thermal + paper design into the server receipt_config,
  // preserving the flat hardware knobs (width / logo / qr / format).
  const persistReceiptDesign = async (nextThermal, nextPaper) => {
    setSavingReceiptDesign(true);
    try {
      const next = { ...receiptConfig, thermal: nextThermal, paper: nextPaper };
      await settingsApi.update('receipt_config', next);
      setReceiptConfig(next);
      cacheReceiptConfig(mergeReceiptConfig(next));
      toast.success('Receipt design saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingReceiptDesign(false);
    }
  };

  const saveReceiptDesign = () => persistReceiptDesign(thermalCfg, paperCfg);

  const resetThermalDesign = () => {
    const d = mergeReceiptConfig(null).thermal;
    setThermalCfg(d);
    persistReceiptDesign(d, paperCfg);
  };

  const resetPaperDesign = () => {
    const d = mergeReceiptConfig(null).paper;
    setPaperCfg(d);
    persistReceiptDesign(thermalCfg, d);
  };

  // Thermal: toggle / reorder sections + style knobs
  const toggleThermalSection = (id) => {
    setThermalCfg((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, enabled: !(s.enabled !== false) } : s)),
    }));
  };
  const moveThermalSection = (idx, dir) => {
    setThermalCfg((prev) => {
      const arr = [...prev.sections];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return prev;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return { ...prev, sections: arr };
    });
  };
  const setThermalStyle = (key, value) => setThermalCfg((prev) => ({ ...prev, [key]: value }));

  // Paper: style knobs, column toggles, free-hand block editing
  const setPaperStyle = (key, value) => setPaperCfg((prev) => ({ ...prev, [key]: value }));
  const togglePaperColumn = (id) =>
    setPaperCfg((prev) => ({ ...prev, columns: { ...prev.columns, [id]: !(prev.columns?.[id] !== false) } }));
  const setBlockField = (block, key, value) =>
    setPaperCfg((prev) => ({ ...prev, blocks: { ...prev.blocks, [block]: { ...prev.blocks[block], [key]: value } } }));

  // Drag a header block around the free-hand A4 canvas. Coordinates are stored
  // in millimetres on a 210mm-wide (A4) canvas.
  const onBlockPointerDown = (e, blockId) => {
    e.preventDefault();
    setActiveBlock(blockId);
    const canvas = paperCanvasRef.current;
    if (!canvas) return;
    const pxPerMm = canvas.getBoundingClientRect().width / 210;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = paperCfg.blocks[blockId].x;
    const origY = paperCfg.blocks[blockId].y;
    const maxY = Math.max(2, (paperCfg.headerHeight || 40) - 2);
    const move = (ev) => {
      const nx = Math.max(0, Math.min(200, Math.round(origX + (ev.clientX - startX) / pxPerMm)));
      const ny = Math.max(0, Math.min(maxY, Math.round(origY + (ev.clientY - startY) / pxPerMm)));
      setPaperCfg((prev) => ({ ...prev, blocks: { ...prev.blocks, [blockId]: { ...prev.blocks[blockId], x: nx, y: ny } } }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Live design preview — a sample sale rendered through the current config.
  const buildDesignPreviewHtml = (format) =>
    buildSaleReceiptHtml({
      sale: {
        sale_number: 'PREVIEW-001',
        date: new Date().toISOString().split('T')[0],
        time: '12:30',
        customer_name: 'Walk-in Customer',
        total_amount: 472.5,
        total_discount: 15,
        bill_discount: 0,
        cash_amount: 472.5,
        upi_amount: 0,
        tendered_amount: 500,
        items: [
          { item_name: 'Masala Dosa', unit: 'Nos', quantity: 2, rate: 90, discount_percent: 0, gst_percent: 5, gst_amount: 9, amount: 189 },
          { item_name: 'Filter Coffee', unit: 'Nos', quantity: 3, rate: 40, discount_percent: 0, gst_percent: 5, gst_amount: 6, amount: 126 },
          { item_name: 'Paneer Roll', unit: 'Nos', quantity: 1, rate: 175, discount_percent: 10, gst_percent: 12, gst_amount: 15.75, amount: 157.5 },
        ],
      },
      store: profile,
      logoDataUrl: previewLogoDataUrl,
      format,
      config: { ...receiptConfig, thermal: thermalCfg, paper: paperCfg },
      logoHeightMm: thermalLogoHeight,
      upiQrSizeMm: thermalUpiQrSize,
      widthMm: thermalWidth,
    });

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
    { id: 'profile',        label: 'Store Profile'     },
    { id: 'ledgerTypes',    label: 'Ledger Types'      },
    ...(interestModuleEnabled ? [{ id: 'interestSchemes', label: 'Interest Schemes' }] : []),
    { id: 'modules',        label: 'Modules'           },
    { id: 'menuNames',      label: 'Menu Names'        },
    { id: 'receipt',        label: 'Receipt'           },
    { id: 'data',           label: 'Data'              },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
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
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
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
            <div
              onDragOver={(e) => { e.preventDefault(); if (!uploadingLogo) setLogoDragActive(true); }}
              onDragEnter={(e) => { e.preventDefault(); if (!uploadingLogo) setLogoDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget.contains(e.relatedTarget)) return; setLogoDragActive(false); }}
              onDrop={handleLogoDrop}
              className={`flex items-start gap-6 rounded-xl border-2 border-dashed p-4 transition-colors ${
                logoDragActive ? 'border-trust-blue bg-blue-50' : 'border-transparent'
              }`}
            >
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <PhotoIcon className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="space-y-3 flex-1">
                <p className="text-xs text-slate-500">
                  {logoDragActive
                    ? 'Drop the image to upload'
                    : 'Drag & drop an image here, or use the button. PNG, JPEG, SVG. Max 2MB. Will appear on printed receipts.'}
                </p>
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
              <div>
                <label className="label">Place</label>
                <input
                  type="text"
                  value={profile.place}
                  onChange={(e) => setProfile((p) => ({ ...p, place: e.target.value }))}
                  className="input-field"
                  placeholder="City / Town"
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
              <div>
                <label className="label">UPI ID</label>
                <input
                  type="text"
                  value={profile.upi_id}
                  onChange={(e) => setProfile((p) => ({ ...p, upi_id: e.target.value }))}
                  className="input-field"
                  placeholder="yourname@bank"
                />
                <p className="text-xs text-slate-500 mt-1">
                  When set, a UPI payment QR code is printed at the bottom of the thermal bill.
                  Adjust its size in the <span className="font-medium">Receipt</span> tab.
                </p>
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

      {/* Interest Schemes Tab */}
      {activeTab === 'interestSchemes' && (
        <div className="space-y-4">
          {/* Create New Scheme */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Create Interest Scheme</h2>
            <form onSubmit={handleCreateScheme} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="label">Scheme Name</label>
                <input
                  type="text"
                  value={schForm.name}
                  onChange={(e) => setSchForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Gold Loan, Flat Rate"
                />
              </div>
              <div className="w-44">
                <label className="label">Nature</label>
                <select
                  value={schForm.nature}
                  onChange={(e) => setSchForm((f) => ({ ...f, nature: e.target.value }))}
                  className="input-field"
                >
                  <option value="DAILY">Daily</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <button type="submit" disabled={schSaving} className="btn-primary text-sm gap-1 whitespace-nowrap">
                <PlusIcon className="h-4 w-4" />
                Add Scheme
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-3">
              <strong>Daily</strong> — interest is accrued once per calendar day.{' '}
              <strong>Monthly</strong> — interest is accrued once per month at the end of each period.
            </p>
          </div>

          {/* Existing Schemes */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Interest Schemes</h2>
            <div className="space-y-2">
              {schemes.map((sch) => (
                <div key={sch.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                  {editingScheme?.id === sch.id ? (
                    <form onSubmit={handleUpdateScheme} className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={editingScheme.name}
                        onChange={(e) => setEditingScheme((p) => ({ ...p, name: e.target.value }))}
                        className="input-field flex-1"
                        autoFocus
                      />
                      <select
                        value={editingScheme.nature}
                        onChange={(e) => setEditingScheme((p) => ({ ...p, nature: e.target.value }))}
                        className="input-field w-36"
                        disabled={!!schemes.find((s) => s.id === editingScheme.id)?.is_system}
                        title={schemes.find((s) => s.id === editingScheme.id)?.is_system ? 'Nature is locked for system schemes' : undefined}
                      >
                        <option value="DAILY">Daily</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                      <button type="submit" disabled={schSaving} className="btn-primary text-xs">Save</button>
                      <button type="button" onClick={() => setEditingScheme(null)} className="btn-secondary text-xs">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-slate-800">{sch.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sch.nature === 'DAILY'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {sch.nature === 'DAILY' ? 'Daily' : 'Monthly'}
                      </span>
                      <div className="flex items-center gap-1">
                        {sch.is_system && (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">SYSTEM</span>
                        )}
                        <button
                          onClick={() => setEditingScheme({ id: sch.id, name: sch.name, nature: sch.nature })}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {!sch.is_system && (
                          <button
                            onClick={() => handleDeleteScheme(sch.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {schemes.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No interest schemes found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Feature Modules</h2>
            <p className="text-xs text-slate-500 mb-6">Enable or disable optional feature modules. Changes take effect immediately.</p>

            <div className="space-y-6">
              {/* Group: Inventory & Sales */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Inventory &amp; Sales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ModuleToggle
                    label="Purchase Module"
                    settingKey="purchase_module_enabled"
                    checked={purchaseModuleEnabled}
                    onChange={setPurchaseModuleEnabled}
                    toastLabel="Purchase module"
                  />
                  <ModuleToggle
                    label="Multi Counter (Item Sales)"
                    settingKey="multi_counter_enabled"
                    checked={multiCounterEnabled}
                    onChange={setMultiCounterEnabled}
                    toastLabel="Multi counter"
                  />
                  <ModuleToggle
                    label="IMEI / Serial Tracking"
                    settingKey="imei_tracking_enabled"
                    checked={imeiTrackingEnabled}
                    onChange={setImeiTrackingEnabled}
                    toastLabel="IMEI tracking"
                  />
                  <ModuleToggle
                    label="GST / Tax Fields"
                    settingKey="gst_fields_enabled"
                    checked={gstFieldsEnabled}
                    onChange={setGstFieldsEnabled}
                    toastLabel="GST fields"
                  />
                  <ModuleToggle
                    label="Cash Tender Field"
                    settingKey="cash_tender_enabled"
                    checked={cashTenderEnabled}
                    onChange={setCashTenderEnabled}
                    toastLabel="Cash tender field"
                  />
                  <ModuleToggle
                    label="Freight Charge Field"
                    settingKey="freight_charge_enabled"
                    checked={freightChargeEnabled}
                    onChange={setFreightChargeEnabled}
                    toastLabel="Freight charge field"
                  />
                  <ModuleToggle
                    label="PO Number Field"
                    settingKey="po_number_enabled"
                    checked={poNumberEnabled}
                    onChange={setPoNumberEnabled}
                    toastLabel="PO number field"
                  />
                </div>
              </div>

              {/* Group: Accounts */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Accounts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ModuleToggle
                    label="Account Transaction"
                    settingKey="account_transaction_enabled"
                    checked={accountTransactionEnabled}
                    onChange={setAccountTransactionEnabled}
                    toastLabel="Account transaction"
                  />
                  <ModuleToggle
                    label="Interest Module"
                    settingKey="interest_module_enabled"
                    checked={interestModuleEnabled}
                    onChange={setInterestModuleEnabled}
                    toastLabel="Interest module"
                  />
                  <ModuleToggle
                    label="Expense Module"
                    settingKey="expense_module_enabled"
                    checked={expenseModuleEnabled}
                    onChange={setExpenseModuleEnabled}
                    toastLabel="Expense module"
                  />
                </div>
              </div>

              {/* Group: Business Type */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Business Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ModuleToggle
                    label="Service Module"
                    settingKey="service_module_enabled"
                    checked={serviceModuleEnabled}
                    onChange={setServiceModuleEnabled}
                    toastLabel="Service module"
                  />
                  <ModuleToggle
                    label="Restaurant Module"
                    settingKey="restaurant_module_enabled"
                    checked={restaurantModuleEnabled}
                    onChange={setRestaurantModuleEnabled}
                    toastLabel="Restaurant module"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Names Tab */}
      {activeTab === 'menuNames' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Sidebar Menu Names</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rename any sidebar menu. Leave a field blank to use its default name.
                  Some menus only appear when their module is enabled.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetMenuLabels}
                  disabled={savingMenuLabels}
                  className="btn-secondary text-xs"
                >
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveMenuLabels}
                  disabled={savingMenuLabels}
                  className="btn-primary text-xs"
                >
                  {savingMenuLabels ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="space-y-6 mt-5">
              {SIDEBAR_MENU_GROUPS.map((group) => (
                <div key={group.section}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    {group.section}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.items.map((name) => (
                      <div key={name} className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">{name}</label>
                        <input
                          type="text"
                          className="input-field text-sm"
                          value={menuLabels[name] ?? ''}
                          placeholder={name}
                          onChange={(e) => handleMenuLabelChange(name, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Tab */}
      {activeTab === 'receipt' && (
        <div className="space-y-4">
          {/* Inner sub-tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {[
              { id: 'print', label: 'Print Settings' },
              { id: 'thermal', label: 'Thermal Design' },
              { id: 'paper', label: 'A4 / A5 Design' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setReceiptSubTab(st.id)}
                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                  receiptSubTab === st.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Print Settings */}
          {receiptSubTab === 'print' && (
            <div className="card">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Receipt Printing</h2>
              <p className="text-xs text-slate-500 mb-6">Enable or disable automatic print-preview per module. Disabled by default.</p>

              {/* Default Print Format */}
              <div className="p-4 rounded-lg border border-slate-200 bg-white mb-6">
                <h3 className="text-sm font-semibold text-slate-800">Default Print Format</h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  The paper size used when opening a receipt/invoice preview across the app.
                  You can still switch the format inside any preview.
                </p>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { value: 'thermal', label: 'Thermal 80mm' },
                    { value: 'a5', label: 'A5' },
                    { value: 'a4', label: 'A4' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={savingPrintFormat}
                      onClick={async () => {
                        if (opt.value === defaultPrintFormat) return;
                        const prev = defaultPrintFormat;
                        setDefaultPrintFormat(opt.value);
                        setSavingPrintFormat(true);
                        try {
                          const newCfg = { ...receiptConfig, format: opt.value };
                          await settingsApi.update('receipt_config', newCfg);
                          setReceiptConfig(newCfg);
                          toast.success(`Default print format set to ${opt.label}`);
                        } catch (err) {
                          setDefaultPrintFormat(prev);
                          toast.error(err.message);
                        } finally {
                          setSavingPrintFormat(false);
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-r border-slate-200 last:border-r-0 disabled:opacity-60 ${
                        defaultPrintFormat === opt.value
                          ? 'bg-trust-blue text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {/* Receipt Printing — Payment/Receipt */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-800">Payments &amp; Receipts</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, a print-preview is automatically opened after recording a payment or
                      receipt, and the print icon is shown in the transaction history.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={printReceiptsPaymentEnabled}
                      onChange={async (e) => {
                        const newVal = e.target.checked;
                        try {
                          await settingsApi.update('print_receipts_payment_enabled', String(newVal));
                          setPrintReceiptsPaymentEnabled(newVal);
                          toast.success(`Payment receipt printing ${newVal ? 'enabled' : 'disabled'}`);
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </div>

                {/* Receipt Printing — Interest */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-800">Interest</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, a print-preview is automatically opened after marking interest as paid,
                      and the print icon is shown for each paid interest entry.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={printReceiptsInterestEnabled}
                      onChange={async (e) => {
                        const newVal = e.target.checked;
                        try {
                          await settingsApi.update('print_receipts_interest_enabled', String(newVal));
                          setPrintReceiptsInterestEnabled(newVal);
                          toast.success(`Interest receipt printing ${newVal ? 'enabled' : 'disabled'}`);
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </div>

                {/* Receipt Printing — Sales */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-800">Sales Invoice</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, a thermal/A4/A5 invoice preview is automatically opened after saving a
                      sale. The format follows the global receipt format chosen below.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={printReceiptsSaleEnabled}
                      onChange={async (e) => {
                        const newVal = e.target.checked;
                        try {
                          await settingsApi.update('print_receipts_sale_enabled', String(newVal));
                          setPrintReceiptsSaleEnabled(newVal);
                          toast.success(`Sales receipt printing ${newVal ? 'enabled' : 'disabled'}`);
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
          )}

          {/* Thermal Design */}
          {receiptSubTab === 'thermal' && (
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Thermal Receipt Design</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Toggle and reorder sections, tune the text style. 80mm POS roll.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={resetThermalDesign} disabled={savingReceiptDesign} className="btn-secondary text-xs gap-1 disabled:opacity-60">
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <button onClick={saveReceiptDesign} disabled={savingReceiptDesign} className="btn-primary text-xs disabled:opacity-60">
                    {savingReceiptDesign ? 'Saving…' : 'Save Design'}
                  </button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr_auto] items-start mt-4">
                <div className="space-y-5">
                  {/* Sections */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Sections</h3>
                    <div className="space-y-1">
                      {thermalCfg.sections.map((s, idx) => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                            s.enabled !== false ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={s.enabled !== false}
                              onChange={() => toggleThermalSection(s.id)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-trust-blue transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                          </label>
                          <span className={`flex-1 text-sm ${s.enabled !== false ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                            {THERMAL_SECTION_LABELS[s.id] || s.id}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => moveThermalSection(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-400">
                              <ArrowUpIcon className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => moveThermalSection(idx, 1)} disabled={idx === thermalCfg.sections.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-400">
                              <ArrowDownIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Style knobs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Store Name Size ({thermalCfg.storeNameSize}pt)</label>
                      <input type="range" min="9" max="24" step="1" value={thermalCfg.storeNameSize} onChange={(e) => setThermalStyle('storeNameSize', Number(e.target.value))} className="w-full accent-trust-blue" />
                    </div>
                    <div>
                      <label className="label">Body Text Size ({thermalCfg.baseSize}pt)</label>
                      <input type="range" min="7" max="13" step="0.5" value={thermalCfg.baseSize} onChange={(e) => setThermalStyle('baseSize', Number(e.target.value))} className="w-full accent-trust-blue" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Receipt Title</label>
                      <input type="text" value={thermalCfg.titleText} onChange={(e) => setThermalStyle('titleText', e.target.value)} className="input-field" placeholder="Retail Invoice" />
                    </div>
                    <div>
                      <label className="label">Footer Text</label>
                      <input type="text" value={thermalCfg.footerText} onChange={(e) => setThermalStyle('footerText', e.target.value)} className="input-field" placeholder="Thank you · Visit again" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={thermalCfg.showDividers !== false} onChange={(e) => setThermalStyle('showDividers', e.target.checked)} className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue" />
                    <span className="text-sm text-slate-700">Show dashed dividers between sections</span>
                  </label>

                  {/* Printer Hardware — roll width, logo & QR sizing */}
                  <div className="pt-5 border-t border-slate-200 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-800">Printer Hardware</h3>

                    {/* Thermal Paper Width */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label mb-0">Paper Width ({thermalWidth}mm)</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={savingThermalWidth}
                            onClick={() => { setThermalWidth(58); saveThermalWidth(58); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${thermalWidth === 58 ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-slate-500 border-slate-200'} disabled:opacity-60`}
                          >
                            58
                          </button>
                          <button
                            type="button"
                            disabled={savingThermalWidth}
                            onClick={() => { setThermalWidth(80); saveThermalWidth(80); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${thermalWidth === 80 ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-slate-500 border-slate-200'} disabled:opacity-60`}
                          >
                            80
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="80"
                        step="1"
                        value={thermalWidth}
                        disabled={savingThermalWidth}
                        onChange={(e) => setThermalWidth(Number(e.target.value))}
                        onMouseUp={(e) => saveThermalWidth(e.target.value)}
                        onTouchEnd={(e) => saveThermalWidth(e.target.value)}
                        onKeyUp={(e) => saveThermalWidth(e.target.value)}
                        className="w-full accent-trust-blue cursor-pointer"
                      />
                    </div>

                    {/* Thermal Logo Size */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label mb-0">Logo Size ({thermalLogoHeight}mm)</label>
                        {(previewLogoDataUrl || logoPreview) && (
                          <button
                            type="button"
                            disabled={savingLogoHeight}
                            onClick={() => { setThermalLogoHeight(12); saveThermalLogoHeight(12); }}
                            className="text-[10px] text-slate-400 hover:text-trust-blue disabled:opacity-60"
                          >
                            Reset to 12mm
                          </button>
                        )}
                      </div>
                      {(previewLogoDataUrl || logoPreview) ? (
                        <input
                          type="range"
                          min="6"
                          max="72"
                          step="1"
                          value={thermalLogoHeight}
                          disabled={savingLogoHeight}
                          onChange={(e) => setThermalLogoHeight(Number(e.target.value))}
                          onMouseUp={(e) => saveThermalLogoHeight(e.target.value)}
                          onTouchEnd={(e) => saveThermalLogoHeight(e.target.value)}
                          onKeyUp={(e) => saveThermalLogoHeight(e.target.value)}
                          className="w-full accent-trust-blue cursor-pointer"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-400">Upload a logo in Store Profile to size it.</p>
                      )}
                    </div>

                    {/* Thermal UPI QR Size */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label mb-0">UPI QR Size ({thermalUpiQrSize}mm)</label>
                        {profile.upi_id && profile.upi_id.trim() && (
                          <button
                            type="button"
                            disabled={savingUpiQrSize}
                            onClick={() => { setThermalUpiQrSize(28); saveThermalUpiQrSize(28); }}
                            className="text-[10px] text-slate-400 hover:text-trust-blue disabled:opacity-60"
                          >
                            Reset to 28mm
                          </button>
                        )}
                      </div>
                      {profile.upi_id && profile.upi_id.trim() ? (
                        <input
                          type="range"
                          min="15"
                          max="50"
                          step="1"
                          value={thermalUpiQrSize}
                          disabled={savingUpiQrSize}
                          onChange={(e) => setThermalUpiQrSize(Number(e.target.value))}
                          onMouseUp={(e) => saveThermalUpiQrSize(e.target.value)}
                          onTouchEnd={(e) => saveThermalUpiQrSize(e.target.value)}
                          onKeyUp={(e) => saveThermalUpiQrSize(e.target.value)}
                          className="w-full accent-trust-blue cursor-pointer"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-400">Add a UPI ID in Store Profile to print a QR code.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                <div className="justify-self-center self-start sticky top-4">
                  <div className="text-[10px] font-medium text-slate-400 mb-1 text-center uppercase tracking-wide">Live Preview</div>
                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-2 shadow-inner">
                    <iframe title="Thermal design preview" srcDoc={buildDesignPreviewHtml('thermal')} className="block bg-white rounded" style={{ width: '340px', height: '460px', border: 'none' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* A4 / A5 Design */}
          {receiptSubTab === 'paper' && (
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">A4 / A5 Invoice Design</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Drag the header blocks anywhere, then style the invoice body.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={resetPaperDesign} disabled={savingReceiptDesign} className="btn-secondary text-xs gap-1 disabled:opacity-60">
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <button onClick={saveReceiptDesign} disabled={savingReceiptDesign} className="btn-primary text-xs disabled:opacity-60">
                    {savingReceiptDesign ? 'Saving…' : 'Save Design'}
                  </button>
                </div>
              </div>

              {/* Free-hand header canvas */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-800">Header Layout (free-hand)</h3>
                  <span className="text-xs text-slate-400">A4 · 210mm wide</span>
                </div>
                <div
                  ref={paperCanvasRef}
                  className="relative w-full bg-white border border-slate-300 rounded-lg overflow-hidden select-none"
                  style={{ aspectRatio: `210 / ${paperCfg.headerHeight || 40}` }}
                >
                  {['logo', 'store', 'meta'].map((id) => {
                    const b = paperCfg.blocks[id];
                    if (!b || b.enabled === false) return null;
                    return (
                      <div
                        key={id}
                        onPointerDown={(e) => onBlockPointerDown(e, id)}
                        className={`absolute cursor-move rounded border px-1.5 py-1 text-[10px] font-semibold truncate ${
                          activeBlock === id ? 'border-trust-blue bg-blue-50 text-trust-blue z-10' : 'border-slate-300 bg-slate-50 text-slate-500'
                        }`}
                        style={{ left: `${(b.x / 210) * 100}%`, top: `${(b.y / (paperCfg.headerHeight || 40)) * 100}%`, width: `${(b.w / 210) * 100}%` }}
                      >
                        {id === 'logo' ? 'Logo' : id === 'store' ? 'Store Info' : 'Invoice Meta'}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {['logo', 'store', 'meta'].map((id) => (
                    <button
                      key={id}
                      onClick={() => setActiveBlock(id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        activeBlock === id ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {id === 'logo' ? 'Logo' : id === 'store' ? 'Store Info' : 'Invoice Meta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active block controls */}
              <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="label">X ({paperCfg.blocks[activeBlock].x}mm)</label>
                    <input type="range" min="0" max="200" value={paperCfg.blocks[activeBlock].x} onChange={(e) => setBlockField(activeBlock, 'x', Number(e.target.value))} className="w-full accent-trust-blue" />
                  </div>
                  <div>
                    <label className="label">Y ({paperCfg.blocks[activeBlock].y}mm)</label>
                    <input type="range" min="0" max={(paperCfg.headerHeight || 40) - 2} value={paperCfg.blocks[activeBlock].y} onChange={(e) => setBlockField(activeBlock, 'y', Number(e.target.value))} className="w-full accent-trust-blue" />
                  </div>
                  <div>
                    <label className="label">Width ({paperCfg.blocks[activeBlock].w}mm)</label>
                    <input type="range" min="10" max="200" value={paperCfg.blocks[activeBlock].w} onChange={(e) => setBlockField(activeBlock, 'w', Number(e.target.value))} className="w-full accent-trust-blue" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={paperCfg.blocks[activeBlock].enabled !== false} onChange={(e) => setBlockField(activeBlock, 'enabled', e.target.checked)} className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue" />
                      <span className="text-xs text-slate-700">Show</span>
                    </label>
                    {activeBlock !== 'logo' && (
                      <select value={paperCfg.blocks[activeBlock].align || (activeBlock === 'meta' ? 'right' : 'left')} onChange={(e) => setBlockField(activeBlock, 'align', e.target.value)} className="input-field text-xs py-1">
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Header Band Height ({paperCfg.headerHeight}mm)</label>
                  <input type="range" min="18" max="70" value={paperCfg.headerHeight} onChange={(e) => setPaperStyle('headerHeight', Number(e.target.value))} className="w-full accent-trust-blue" />
                </div>
              </div>

              {/* Style + columns + preview */}
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] items-start mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Accent Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={paperCfg.accentColor} onChange={(e) => setPaperStyle('accentColor', e.target.value)} className="w-10 h-10 rounded border border-slate-200 cursor-pointer" />
                        <input type="text" value={paperCfg.accentColor} onChange={(e) => setPaperStyle('accentColor', e.target.value)} className="input-field w-28 font-mono text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Font Scale ({paperCfg.fontScale}×)</label>
                      <input type="range" min="0.8" max="1.3" step="0.05" value={paperCfg.fontScale} onChange={(e) => setPaperStyle('fontScale', Number(e.target.value))} className="w-full accent-trust-blue" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Font Family</label>
                    <select value={paperCfg.fontFamily} onChange={(e) => setPaperStyle('fontFamily', e.target.value)} className="input-field">
                      <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica (Default)</option>
                      <option value="'Segoe UI', system-ui, -apple-system, sans-serif">Segoe UI</option>
                      <option value="'Arial', sans-serif">Arial</option>
                      <option value="'Courier New', monospace">Courier New (Monospace)</option>
                      <option value="'Georgia', serif">Georgia (Serif)</option>
                      <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Invoice Title</label>
                      <input type="text" value={paperCfg.titleText} onChange={(e) => setPaperStyle('titleText', e.target.value)} className="input-field" placeholder="Tax Invoice" />
                    </div>
                    <div>
                      <label className="label">Thank-you Line</label>
                      <input type="text" value={paperCfg.thanksText} onChange={(e) => setPaperStyle('thanksText', e.target.value)} className="input-field" placeholder="Thank you for your business" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Signature Label</label>
                    <input type="text" value={paperCfg.signatureLabel} onChange={(e) => setPaperStyle('signatureLabel', e.target.value)} className="input-field" placeholder="Authorised Signatory" />
                  </div>
                  <div>
                    <label className="label">Terms &amp; Conditions</label>
                    <textarea rows="2" value={paperCfg.termsText} onChange={(e) => setPaperStyle('termsText', e.target.value)} className="input-field" />
                  </div>

                  {/* Column toggles */}
                  <div>
                    <label className="label">Item Table Columns</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(PAPER_COLUMN_LABELS).map((id) => (
                        <button
                          key={id}
                          onClick={() => togglePaperColumn(id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            paperCfg.columns?.[id] !== false ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          {PAPER_COLUMN_LABELS[id]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Item, Qty and Amount are always shown.</p>
                  </div>

                  {/* Section toggles */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={paperCfg.showWords !== false} onChange={(e) => setPaperStyle('showWords', e.target.checked)} className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue" /><span className="text-sm text-slate-700">Amount in words</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={paperCfg.showTerms !== false} onChange={(e) => setPaperStyle('showTerms', e.target.checked)} className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue" /><span className="text-sm text-slate-700">Terms</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={paperCfg.showSignature !== false} onChange={(e) => setPaperStyle('showSignature', e.target.checked)} className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue" /><span className="text-sm text-slate-700">Signature</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={paperCfg.showBorder !== false} onChange={(e) => setPaperStyle('showBorder', e.target.checked)} className="h-4 w-4 rounded text-trust-blue focus:ring-trust-blue" /><span className="text-sm text-slate-700">Outer border</span></label>
                  </div>
                </div>

                {/* Live preview */}
                <div className="justify-self-center self-start sticky top-4">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {['a4', 'a5'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setPaperPreviewFormat(f)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                          paperPreviewFormat === f ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                    <button
                      onClick={() => setFullscreenPreview(true)}
                      className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border bg-white text-slate-500 border-slate-200 hover:text-trust-blue hover:border-trust-blue"
                      title="Preview full screen"
                    >
                      <ArrowsPointingOutIcon className="h-3 w-3" />
                      Full screen
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-2 shadow-inner">
                    <iframe title="Paper design preview" srcDoc={buildDesignPreviewHtml(paperPreviewFormat)} className="block bg-white rounded" style={{ width: '360px', height: '480px', border: 'none' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div className="space-y-4">

          {/* Backup */}
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

          {/* Danger Zone */}
          <div className="card border-red-100">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-semibold text-slate-900">Danger Zone</h2>
              <span className="text-xs text-slate-400">Irreversible — back up first.</span>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {/* Clear All Data */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-800">Clear All Data</h3>
                  <p className="text-xs text-slate-500 truncate">Deletes ledgers, transactions, interest & expenses. Settings kept.</p>
                </div>
                {!confirmClearData ? (
                  <button
                    onClick={() => setConfirmClearData(true)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Clear Data
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirmClearData(false)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={clearingData}
                      onClick={async () => {
                        try {
                          setClearingData(true);
                          await settingsApi.clearData();
                          toast.success('All data cleared');
                        } catch (err) {
                          toast.error(err.message);
                        } finally {
                          setClearingData(false);
                          setConfirmClearData(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                    >
                      {clearingData ? 'Clearing…' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>

              {/* Clear Transactional Data */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-800">Clear Transactional Data</h3>
                  <p className="text-xs text-slate-500 truncate">Clears sales, purchases, returns, services & resets balances. Masters kept.</p>
                </div>
                {!confirmClearTransactions ? (
                  <button
                    onClick={() => setConfirmClearTransactions(true)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Clear Transactions
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirmClearTransactions(false)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={clearingTransactions}
                      onClick={async () => {
                        try {
                          setClearingTransactions(true);
                          await settingsApi.clearTransactions();
                          toast.success('Transactional data cleared');
                        } catch (err) {
                          toast.error(err.message);
                        } finally {
                          setClearingTransactions(false);
                          setConfirmClearTransactions(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                    >
                      {clearingTransactions ? 'Clearing…' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>

              {/* Reset Settings */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-800">Reset Settings</h3>
                  <p className="text-xs text-slate-500 truncate">Resets all settings to factory defaults. Ledger data not affected.</p>
                </div>
                {!confirmResetSettings ? (
                  <button
                    onClick={() => setConfirmResetSettings(true)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    Reset Settings
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirmResetSettings(false)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={resettingSettings}
                      onClick={async () => {
                        try {
                          setResettingSettings(true);
                          await settingsApi.resetSettings();
                          toast.success('Settings reset to defaults');
                        } catch (err) {
                          toast.error(err.message);
                        } finally {
                          setResettingSettings(false);
                          setConfirmResetSettings(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
                    >
                      {resettingSettings ? 'Resetting…' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen A4/A5 preview overlay */}
      {fullscreenPreview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm"
          onClick={() => setFullscreenPreview(false)}
        >
          <div className="flex items-center justify-center gap-2 py-3">
            {['a4', 'a5'].map((f) => (
              <button
                key={f}
                onClick={(e) => { e.stopPropagation(); setPaperPreviewFormat(f); }}
                className={`px-3 py-1 rounded text-xs font-semibold uppercase border ${
                  paperPreviewFormat === f ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => setFullscreenPreview(false)}
              className="ml-2 flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold border bg-white text-slate-600 border-slate-200 hover:text-red-600 hover:border-red-300"
              title="Close preview"
            >
              <XMarkIcon className="h-4 w-4" />
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <iframe
              title="Paper design full-screen preview"
              srcDoc={buildDesignPreviewHtml(paperPreviewFormat)}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded shadow-2xl"
              style={{
                width: paperPreviewFormat === 'a4' ? '794px' : '559px',
                height: paperPreviewFormat === 'a4' ? '1123px' : '794px',
                maxWidth: '100%',
                maxHeight: '100%',
                border: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
