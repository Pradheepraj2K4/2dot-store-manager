import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { itemApi } from '../../api';
import { ITEM_UNITS, DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import LoadingSpinner from '../ui/LoadingSpinner';

function validate(form) {
  const errors = {};
  if (!form.name || !form.name.trim()) errors.name = 'Item name is required.';
  if (form.mrp !== '' && isNaN(parseFloat(form.mrp))) errors.mrp = 'MRP must be a number.';
  else if (form.mrp !== '' && parseFloat(form.mrp) < 0) errors.mrp = 'MRP cannot be negative.';
  if (form.gst_percent !== '' && isNaN(parseFloat(form.gst_percent))) errors.gst_percent = 'GST % must be a number.';
  else if (form.gst_percent !== '' && parseFloat(form.gst_percent) < 0) errors.gst_percent = 'GST % cannot be negative.';
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

export default function ItemCreationPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const initialName = searchParams.get('name') || '';
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: initialName,
    item_code: '',
    unit: DEFAULT_ITEM_UNIT,
    mrp: '',
    gst_percent: '',
    brand: '',
    category: '',
  });
  const [errors, setErrors] = useState({});
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    itemApi.getBrands().then((r) => setBrands(r.data || [])).catch(() => {});
    itemApi.getCategories().then((r) => setCategories(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    itemApi.getById(id)
      .then((res) => {
        const it = res.data;
        setForm({
          name: it.name,
          item_code: it.item_code || '',
          unit: it.unit || DEFAULT_ITEM_UNIT,
          mrp: it.mrp != null ? String(it.mrp) : '',
          gst_percent: it.gst_percent != null && it.gst_percent !== 0 ? String(it.gst_percent) : '',
          brand: it.brand || '',
          category: it.category || '',
        });
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // Enter-key navigation between form fields
  const FIELD_ORDER = ['name', 'item_code', 'unit', 'mrp', 'gst_percent', 'brand', 'category'];
  const fieldRefs = useRef({});
  const setFieldRef = (name) => (el) => { fieldRefs.current[name] = el; };
  const submitBtnRef = useRef(null);
  const handleFieldKeyDown = (name) => (e) => {
    if (e.key !== 'Enter') return;
    // Allow textareas to keep multiline behaviour (none here, but future-proof)
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const idx = FIELD_ORDER.indexOf(name);
    if (idx === -1 || idx === FIELD_ORDER.length - 1) {
      submitBtnRef.current?.focus();
      submitBtnRef.current?.click();
      return;
    }
    const next = fieldRefs.current[FIELD_ORDER[idx + 1]];
    next?.focus();
    if (next && typeof next.select === 'function') next.select();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        item_code: form.item_code.trim(),
        unit: form.unit,
        mrp: parseFloat(form.mrp) || 0,
        gst_percent: parseFloat(form.gst_percent) || 0,
        brand: form.brand.trim(),
        category: form.category.trim(),
      };
      const res = isEdit
        ? await itemApi.update(id, payload)
        : await itemApi.create(payload);
      toast.success(isEdit ? 'Item updated' : 'Item created');
      if (returnTo) {
        // Send the newly created/updated item back to the originating page.
        const item = res.data;
        sessionStorage.setItem('lastCreatedItem', JSON.stringify(item));
        navigate(returnTo);
      } else {
        navigate('/items');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(returnTo || -1)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Item' : 'New Item'}</h1>
          <p className="text-sm text-slate-500">
            {isEdit ? `Item #${id}` : 'Item ID is auto-generated on save.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4" noValidate>

        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Item Code</label>
          <div className="flex-1">
            <input
              ref={setFieldRef('item_code')}
              type="text"
              name="item_code"
              value={form.item_code}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('item_code')}
              className="input-field"
              placeholder="Optional SKU / barcode — e.g. SX-1KG"
            />
            <p className="text-xs text-slate-400 mt-1">Searchable from sales &amp; purchase entry.</p>
          </div>
        </div>

        {/* Item Name */}
        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Item Name *</label>
          <div className="flex-1">
            <input
              autoFocus
              ref={setFieldRef('name')}
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('name')}
              className={`input-field ${errors.name ? 'border-red-400' : ''}`}
              placeholder="e.g. Surf Excel 1kg"
            />
            <FieldError msg={errors.name} />
          </div>
        </div>

        {/* Unit */}
        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Unit</label>
          <div className="flex-1">
            <select
              ref={setFieldRef('unit')}
              name="unit"
              value={form.unit}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('unit')}
              className="input-field"
            >
              {ITEM_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* MRP */}
        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">MRP</label>
          <div className="flex-1">
            <input
              ref={setFieldRef('mrp')}
              type="number"
              step="0.01"
              name="mrp"
              value={form.mrp}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('mrp')}
              className={`input-field ${errors.mrp ? 'border-red-400' : ''}`}
              placeholder="0.00"
            />
            <FieldError msg={errors.mrp} />
          </div>
        </div>

        {/* GST % */}
        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">GST %</label>
          <div className="flex-1">
            <input
              ref={setFieldRef('gst_percent')}
              type="number"
              step="0.01"
              min="0"
              name="gst_percent"
              value={form.gst_percent}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('gst_percent')}
              className={`input-field ${errors.gst_percent ? 'border-red-400' : ''}`}
              placeholder="e.g. 18"
            />
            <FieldError msg={errors.gst_percent} />
          </div>
        </div>

        {/* Brand */}
        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Brand</label>
          <div className="flex-1">
            <input
              ref={setFieldRef('brand')}
              type="text"
              name="brand"
              value={form.brand}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('brand')}
              list="item-brand-list"
              className="input-field"
              placeholder="e.g. HUL"
            />
            <datalist id="item-brand-list">
              {brands.map((b) => <option key={b} value={b} />)}
            </datalist>
          </div>
        </div>

        {/* Category */}
        <div className="flex gap-4">
          <label className="w-28 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Category</label>
          <div className="flex-1">
            <input
              ref={setFieldRef('category')}
              type="text"
              name="category"
              value={form.category}
              onChange={handleChange}
              onKeyDown={handleFieldKeyDown('category')}
              list="item-category-list"
              className="input-field"
              placeholder="e.g. Detergent"
            />
            <datalist id="item-category-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(returnTo || '/items')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button ref={submitBtnRef} type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Item')}
          </button>
        </div>
      </form>
    </div>
  );
}
