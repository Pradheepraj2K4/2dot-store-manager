import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  CheckIcon,
  CubeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { itemApi } from '../../api';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

// Quick stock-range presets. `min`/`max` are inclusive; null means unbounded.
const RANGE_PRESETS = [
  { key: 'all', label: 'All', min: '', max: '' },
  { key: 'negative', label: 'Negative (< 0)', min: '', max: '-1' },
  { key: 'zero', label: 'Zero (0)', min: '0', max: '0' },
  { key: 'positive', label: 'Positive (> 0)', min: '1', max: '' },
  { key: 'lowzero', label: '0 or below', min: '', max: '0' },
];

export default function StockAdjustmentPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');

  // Map of item id -> edited "updated stock" string (only set once a row is touched).
  const [edited, setEdited] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (brand) params.brand = brand;
      if (category) params.category = category;
      const [report, b, c] = await Promise.all([
        itemApi.getStockReport(params),
        itemApi.getBrands(),
        itemApi.getCategories(),
      ]);
      setRows(report.data || []);
      setBrands(b.data || []);
      setCategories(c.data || []);
      setEdited({});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [brand, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minStock === '' ? null : parseFloat(minStock);
    const max = maxStock === '' ? null : parseFloat(maxStock);
    return rows.filter((r) => {
      if (q) {
        const match =
          (r.name || '').toLowerCase().includes(q) ||
          (r.item_code || '').toLowerCase().includes(q) ||
          (r.brand || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      const stock = r.current_stock || 0;
      if (min != null && !isNaN(min) && stock < min) return false;
      if (max != null && !isNaN(max) && stock > max) return false;
      return true;
    });
  }, [rows, search, minStock, maxStock]);

  const valueFor = (r) =>
    edited[r.id] !== undefined ? edited[r.id] : String(r.current_stock || 0);

  const isChanged = (r) => {
    if (edited[r.id] === undefined) return false;
    if (edited[r.id] === '') return false;
    return Number(edited[r.id]) !== Number(r.current_stock || 0);
  };

  const changedRows = useMemo(
    () => rows.filter((r) => isChanged(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, edited],
  );

  const handleEdit = (id, raw) => {
    // Allow digits, an optional leading minus and a single decimal point.
    const cleaned = raw.replace(/[^0-9.-]/g, '');
    setEdited((prev) => ({ ...prev, [id]: cleaned }));
  };

  const applyPreset = (p) => {
    setMinStock(p.min);
    setMaxStock(p.max);
  };

  const handleUpdate = async () => {
    if (changedRows.length === 0) return;
    const adjustments = changedRows.map((r) => ({
      id: r.id,
      stock: Number(edited[r.id]),
    }));
    try {
      setSaving(true);
      const res = await itemApi.adjustStock(adjustments);
      toast.success(`Updated stock for ${res.data?.updated ?? adjustments.length} item(s)`);
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/stock-report')}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-5 h-5" /> Back
          </button>
          <h1 className="page-title">Adjust Stocks</h1>
        </div>
        <button
          onClick={handleUpdate}
          disabled={changedRows.length === 0 || saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <CheckIcon className="w-5 h-5" />
          {saving ? 'Updating…' : `Update Stocks${changedRows.length ? ` (${changedRows.length})` : ''}`}
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, brand, category…"
              className="input-field pl-10"
            />
          </div>
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className="input-field max-w-[180px]">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field max-w-[180px]">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Stock range</span>
          <input
            type="number"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="Min"
            className="input-field max-w-[110px]"
          />
          <span className="text-gray-400">to</span>
          <input
            type="number"
            value={maxStock}
            onChange={(e) => setMaxStock(e.target.value)}
            placeholder="Max"
            className="input-field max-w-[110px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_PRESETS.map((p) => {
              const active = minStock === p.min && maxStock === p.max;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-trust-blue text-white border-trust-blue'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CubeIcon}
            title="No items found"
            description="Try changing the search or filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Brand / Category</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Updated Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const changed = isChanged(r);
                  return (
                    <tr key={r.id} className={changed ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-500">{r.item_code || '—'}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {r.brand || '—'}
                        {r.category ? <span className="text-gray-400"> / {r.category}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.unit || '—'}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          (r.current_stock || 0) <= 0 ? 'text-debit-red' : 'text-gray-800'
                        }`}
                      >
                        {r.current_stock || 0}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valueFor(r)}
                            onChange={(e) => handleEdit(r.id, e.target.value)}
                            className={`input-field text-right w-28 ${changed ? 'border-amber-400' : ''}`}
                          />
                          {edited[r.id] !== undefined && (
                            <button
                              type="button"
                              title="Reset to current stock"
                              onClick={() =>
                                setEdited((prev) => {
                                  const next = { ...prev };
                                  delete next[r.id];
                                  return next;
                                })
                              }
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={4}>{filtered.length} items</td>
                  <td className="px-3 py-2 text-right">Changed</td>
                  <td className="px-3 py-2 text-right text-amber-600">{changedRows.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
