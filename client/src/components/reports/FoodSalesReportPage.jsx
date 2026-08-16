import { useState, useEffect, useCallback, useMemo } from 'react';
import { saleApi, itemApi, waiterApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function FoodSalesReportPage() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayISO());
  const [category, setCategory] = useState('');
  const [itemId, setItemId] = useState('');
  const [waiterName, setWaiterName] = useState('');
  const [diningType, setDiningType] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [waiters, setWaiters] = useState([]);

  useEffect(() => {
    itemApi.getCategories().then((r) => setCategories(r.data || [])).catch(() => {});
    itemApi.getAll().then((r) => setItems(r.data || [])).catch(() => {});
    waiterApi.getAll({ status: 'active' }).then((r) => setWaiters(r.data || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { fromDate, toDate };
      if (category) params.category = category;
      if (itemId) params.itemId = itemId;
      if (waiterName) params.waiterName = waiterName;
      if (diningType) params.diningType = diningType;
      const res = await saleApi.getFoodSalesReport(params);
      setRows(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load food sales report');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, category, itemId, waiterName, diningType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => {
      acc.qty += r.qty_sold || 0;
      acc.sales += r.total_sales || 0;
      acc.discount += r.discount || 0;
      return acc;
    },
    { qty: 0, sales: 0, discount: 0 }
  ), [rows]);

  const handleExportExcel = () => {
    const columns = [
      { header: 'Item Name', key: 'item_name', width: 28 },
      { header: 'Qty Sold', key: 'qty_sold', width: 12 },
      { header: 'Unit Price', key: 'unit_price', width: 14 },
      { header: 'Total Sales', key: 'total_sales', width: 14 },
      { header: 'Discount', key: 'discount', width: 14 },
    ];
    exportToExcel(rows, columns, 'Food_Sales_Report');
  };

  const handleExportPDF = () => {
    const headers = ['Item Name', 'Qty Sold', 'Unit Price', 'Total Sales', 'Discount'];
    const data = rows.map((r) => [
      r.item_name,
      r.qty_sold ?? '',
      formatCurrency(r.unit_price || 0).replace('₹', 'Rs. '),
      formatCurrency(r.total_sales || 0).replace('₹', 'Rs. '),
      formatCurrency(r.discount || 0).replace('₹', 'Rs. '),
    ]);
    exportToPDF('Food Sales Report', headers, data, 'Food_Sales_Report');
  };

  const handlePrint = () => {
    const rowsHtml = rows.map((r) => `
      <tr>
        <td>${r.item_name || ''}</td>
        <td style="text-align:right">${r.qty_sold ?? ''}</td>
        <td style="text-align:right">${formatCurrency(r.unit_price || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.total_sales || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.discount || 0)}</td>
      </tr>`).join('');
    const html = `
      <html>
        <head>
          <title>Food Sales Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            p.meta { font-size: 12px; color: #64748b; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            th { background: #f1f5f9; text-align: left; }
            tfoot td { font-weight: bold; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Food Sales Report</h1>
          <p class="meta">${fmtDate(fromDate)} to ${fmtDate(toDate)}${category ? ` &middot; Category: ${category}` : ''}${waiterName ? ` &middot; Waiter: ${waiterName}` : ''}${diningType ? ` &middot; ${diningType === 'take_away' ? 'Take-away' : 'Dining'}` : ''}</p>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th style="text-align:right">Qty Sold</th>
                <th style="text-align:right">Unit Price</th>
                <th style="text-align:right">Total Sales</th>
                <th style="text-align:right">Discount</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td>Total (${rows.length} items)</td>
                <td style="text-align:right">${totals.qty}</td>
                <td></td>
                <td style="text-align:right">${formatCurrency(totals.sales)}</td>
                <td style="text-align:right">${formatCurrency(totals.discount)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    if (!win) return toast.error('Popup blocked. Allow popups to print.');
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-6 w-6 text-trust-blue" />
            Food Sales Report
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-excel gap-2">
            <TableCellsIcon className="h-4 w-4" />Excel
          </button>
          <button onClick={handleExportPDF} className="btn-pdf gap-2">
            <DocumentArrowDownIcon className="h-4 w-4" />PDF
          </button>
          <button onClick={handlePrint} className="btn-print gap-2">
            <PrinterIcon className="h-4 w-4" />Print
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
          <p className="text-xs font-medium text-blue-100">Qty Sold</p>
          <p className="text-xl font-bold text-white mt-1">{totals.qty}</p>
        </div>
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
          <p className="text-xs font-medium text-emerald-100">Total Sales</p>
          <p className="text-xl font-bold text-white mt-1">{formatCurrency(totals.sales)}</p>
        </div>
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
          <p className="text-xs font-medium text-amber-50">Discount</p>
          <p className="text-xl font-bold text-white mt-1">{formatCurrency(totals.discount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="input-field">
            <option value="">All items</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Waiter</label>
          <select value={waiterName} onChange={(e) => setWaiterName(e.target.value)} className="input-field">
            <option value="">All waiters</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.name}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Dining</label>
          <select value={diningType} onChange={(e) => setDiningType(e.target.value)} className="input-field">
            <option value="">All</option>
            <option value="dining">Dining</option>
            <option value="take_away">Take-away</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardDocumentListIcon}
          title="No sales in this range"
          description="Adjust the filters to see item-wise food sales"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200 bg-amber-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Item Name</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Qty Sold</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Unit Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Total Sales</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Discount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.item_id ?? 'x'}-${idx}`} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.item_name}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{r.qty_sold}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(r.unit_price || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{formatCurrency(r.total_sales || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{formatCurrency(r.discount || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Total ({rows.length} items)
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-800">{totals.qty}</td>
                  <td></td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-green-600">{formatCurrency(totals.sales)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-amber-600">{formatCurrency(totals.discount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
