import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, ArrowDownTrayIcon, CubeIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { itemApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import { exportToExcel } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import ImeiInfoButton from '../ui/ImeiInfoButton';

export default function StockReportPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Cache of in-flight / resolved IMEI breakdown promises, keyed by item id, so
  // the three info buttons of a row share a single fetch.
  const breakdownCache = useRef(new Map());
  const getBreakdown = (itemId) => {
    if (!breakdownCache.current.has(itemId)) {
      breakdownCache.current.set(
        itemId,
        itemApi.getImeiBreakdown(itemId).then((res) => res.data || {}),
      );
    }
    return breakdownCache.current.get(itemId);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (brand) params.brand = brand;
      if (category) params.category = category;
      if (lowStockOnly) params.lowStockOnly = 'true';
      const [report, b, c] = await Promise.all([
        itemApi.getStockReport(params),
        itemApi.getBrands(),
        itemApi.getCategories(),
      ]);
      setRows(report.data);
      setBrands(b.data || []);
      setCategories(c.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [brand, category, lowStockOnly]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.item_code || '').toLowerCase().includes(q) ||
      (r.brand || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.purchased += r.total_purchased || 0;
        acc.sold += r.total_sold || 0;
        acc.salesReturn += r.total_sales_return || 0;
        acc.purchaseReturn += r.total_purchase_return || 0;
        acc.stock += r.current_stock || 0;
        acc.value += r.stock_cost || 0;
        return acc;
      },
      { purchased: 0, sold: 0, salesReturn: 0, purchaseReturn: 0, stock: 0, value: 0 },
    );
  }, [filtered]);

  const handleExport = async () => {
    if (filtered.length === 0) return;
    try {
      await exportToExcel(
        filtered.map((r) => ({
          code: r.item_code || '',
          name: r.name,
          brand: r.brand || '',
          category: r.category || '',
          unit: r.unit || '',
          purchased: r.total_purchased || 0,
          purchaseReturn: r.total_purchase_return || 0,
          sold: r.total_sold || 0,
          salesReturn: r.total_sales_return || 0,
          stock: r.current_stock || 0,
          mrp: r.mrp || 0,
          value: r.stock_cost || 0,
        })),
        [
          { header: 'Code', key: 'code', width: 12 },
          { header: 'Item', key: 'name', width: 30 },
          { header: 'Brand', key: 'brand', width: 18 },
          { header: 'Category', key: 'category', width: 18 },
          { header: 'Unit', key: 'unit', width: 8 },
          { header: 'Purchased', key: 'purchased', width: 12 },
          { header: 'Pur. Return', key: 'purchaseReturn', width: 12 },
          { header: 'Sold', key: 'sold', width: 12 },
          { header: 'Sales Return', key: 'salesReturn', width: 12 },
          { header: 'Stock', key: 'stock', width: 10 },
          { header: 'MRP', key: 'mrp', width: 12 },
          { header: 'Stock Cost', key: 'value', width: 14 },
        ],
        'stock-report',
        {
          footer: [
            '', 'Totals', '', '', '',
            totals.purchased, totals.purchaseReturn,
            totals.sold, totals.salesReturn,
            totals.stock, '', totals.value,
          ],
        },
      );
      toast.success('Exported');
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="page-title">Stock Report</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/stock-adjustment')}
            className="btn-secondary flex items-center gap-2"
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" /> Adjust Stocks
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-5 h-5" /> Export
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
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
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Out / low stock only
        </label>
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
                  <th className="px-3 py-2 text-right">Purchased</th>
                  <th className="px-3 py-2 text-right">Pur. Return</th>
                  <th className="px-3 py-2 text-right">Sold</th>
                  <th className="px-3 py-2 text-right">Sales Return</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">MRP</th>
                  <th className="px-3 py-2 text-right">Stock Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{r.item_code || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.brand || '—'}
                      {r.category ? <span className="text-gray-400"> / {r.category}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.unit || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.imei_count > 0 && (
                          <ImeiInfoButton
                            title="Purchased IMEIs"
                            loader={async () => {
                              const b = await getBreakdown(r.id);
                              return [{ items: b.purchased || [], tone: 'blue' }];
                            }}
                          />
                        )}
                        {r.total_purchased || 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-debit-red">{r.total_purchase_return || 0}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.imei_count > 0 && (
                          <ImeiInfoButton
                            title="Sold IMEIs"
                            loader={async () => {
                              const b = await getBreakdown(r.id);
                              return [{ items: b.sold || [], tone: 'green' }];
                            }}
                          />
                        )}
                        {r.total_sold || 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-credit-green">{r.total_sales_return || 0}</td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${
                        (r.current_stock || 0) <= 0 ? 'text-debit-red' : 'text-gray-800'
                      }`}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.imei_count > 0 && (
                          <ImeiInfoButton
                            title="Remaining IMEIs (in stock)"
                            loader={async () => {
                              const b = await getBreakdown(r.id);
                              return [{ items: b.remaining || [], tone: 'slate' }];
                            }}
                          />
                        )}
                        {r.current_stock || 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(r.mrp || 0)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.stock_cost || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={4}>Totals ({filtered.length} items)</td>
                  <td className="px-3 py-2 text-right">{totals.purchased}</td>
                  <td className="px-3 py-2 text-right">{totals.purchaseReturn}</td>
                  <td className="px-3 py-2 text-right">{totals.sold}</td>
                  <td className="px-3 py-2 text-right">{totals.salesReturn}</td>
                  <td className="px-3 py-2 text-right">{totals.stock}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
