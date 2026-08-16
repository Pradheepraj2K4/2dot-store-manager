import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency } from '../../utils/helpers';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
  DocumentChartBarIcon,
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

/**
 * Shared UI for a GST return report (GSTR-1 / GSTR-2). Rows arrive from the
 * server as one entry per invoice + GST rate slab; this renders the invoice
 * detail table plus a rate-wise (slab) subtotal summary and grand totals.
 */
export default function GstReturnReportPage({ title, partyLabel, fetchReport, fileBase }) {
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchReport({ fromDate, toDate });
      setRows(res.data || []);
    } catch (err) {
      toast.error(err.message || `Failed to load ${title}`);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, fetchReport, title]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => {
      acc.taxable += r.taxable_value || 0;
      acc.cgst += r.cgst || 0;
      acc.sgst += r.sgst || 0;
      acc.igst += r.igst || 0;
      acc.total += r.total_value || 0;
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  ), [rows]);

  // Rate-wise subtotals (GST slab summary).
  const slabSummary = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const rate = r.gst_rate || 0;
      const cur = map.get(rate) || { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      cur.taxable += r.taxable_value || 0;
      cur.cgst += r.cgst || 0;
      cur.sgst += r.sgst || 0;
      cur.igst += r.igst || 0;
      cur.total += r.total_value || 0;
      map.set(rate, cur);
    }
    return [...map.values()].sort((a, b) => a.rate - b.rate);
  }, [rows]);

  const handleExportExcel = () => {
    const columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Invoice No', key: 'invoice_no', width: 16 },
      { header: partyLabel, key: 'party_name', width: 26 },
      { header: 'GSTIN', key: 'party_gstin', width: 20 },
      { header: 'Rate %', key: 'gst_rate', width: 10 },
      { header: 'Taxable Value', key: 'taxable_value', width: 16 },
      { header: 'CGST', key: 'cgst', width: 12 },
      { header: 'SGST', key: 'sgst', width: 12 },
      { header: 'IGST', key: 'igst', width: 12 },
      { header: 'Total', key: 'total_value', width: 16 },
    ];
    exportToExcel(rows, columns, fileBase);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Invoice', partyLabel, 'GSTIN', 'Rate %', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'];
    const money = (n) => formatCurrency(n || 0).replace('₹', 'Rs. ');
    const data = rows.map((r) => [
      fmtDate(r.date),
      r.invoice_no ?? '',
      r.party_name ?? '',
      r.party_gstin ?? '',
      `${r.gst_rate ?? 0}%`,
      money(r.taxable_value),
      money(r.cgst),
      money(r.sgst),
      money(r.igst),
      money(r.total_value),
    ]);
    exportToPDF(title, headers, data, fileBase);
  };

  const handlePrint = () => {
    const money = (n) => formatCurrency(n || 0);
    const rowsHtml = rows.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.invoice_no || ''}</td>
        <td>${r.party_name || ''}</td>
        <td>${r.party_gstin || ''}</td>
        <td style="text-align:right">${r.gst_rate ?? 0}%</td>
        <td style="text-align:right">${money(r.taxable_value)}</td>
        <td style="text-align:right">${money(r.cgst)}</td>
        <td style="text-align:right">${money(r.sgst)}</td>
        <td style="text-align:right">${money(r.igst)}</td>
        <td style="text-align:right">${money(r.total_value)}</td>
      </tr>`).join('');
    const html = `
      <html>
        <head>
          <title>${title}</title>
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
          <h1>${title}</h1>
          <p class="meta">${fmtDate(fromDate)} to ${fmtDate(toDate)}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No</th>
                <th>${partyLabel}</th>
                <th>GSTIN</th>
                <th style="text-align:right">Rate %</th>
                <th style="text-align:right">Taxable</th>
                <th style="text-align:right">CGST</th>
                <th style="text-align:right">SGST</th>
                <th style="text-align:right">IGST</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="5">Total (${rows.length} rows)</td>
                <td style="text-align:right">${money(totals.taxable)}</td>
                <td style="text-align:right">${money(totals.cgst)}</td>
                <td style="text-align:right">${money(totals.sgst)}</td>
                <td style="text-align:right">${money(totals.igst)}</td>
                <td style="text-align:right">${money(totals.total)}</td>
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
            <DocumentChartBarIcon className="h-6 w-6 text-trust-blue" />
            {title}
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
          <p className="text-xs font-medium text-blue-100">Taxable Value</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.taxable)}</p>
        </div>
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
          <p className="text-xs font-medium text-emerald-100">CGST</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.cgst)}</p>
        </div>
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
          <p className="text-xs font-medium text-teal-100">SGST</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.sgst)}</p>
        </div>
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
          <p className="text-xs font-medium text-violet-100">IGST</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.igst)}</p>
        </div>
        <div className="card text-center py-4 border-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
          <p className="text-xs font-medium text-amber-50">Total</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.total)}</p>
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
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={DocumentChartBarIcon}
          title="No records in this range"
          description="Adjust the date range to see GST return entries"
        />
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-zebra">
                <thead>
                  <tr className="border-b border-amber-200 bg-amber-100">
                    <th className="px-3 py-3 text-left font-semibold">Date</th>
                    <th className="px-3 py-3 text-left font-semibold">Invoice No</th>
                    <th className="px-3 py-3 text-left font-semibold">{partyLabel}</th>
                    <th className="px-3 py-3 text-left font-semibold">GSTIN</th>
                    <th className="px-3 py-3 text-right font-semibold">Rate %</th>
                    <th className="px-3 py-3 text-right font-semibold">Taxable</th>
                    <th className="px-3 py-3 text-right font-semibold">CGST</th>
                    <th className="px-3 py-3 text-right font-semibold">SGST</th>
                    <th className="px-3 py-3 text-right font-semibold">IGST</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.invoice_no ?? 'x'}-${r.gst_rate}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{r.invoice_no}</td>
                      <td className="px-3 py-2.5 text-slate-700">{r.party_name}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs">{r.party_gstin || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{r.gst_rate}%</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(r.taxable_value || 0)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(r.cgst || 0)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(r.sgst || 0)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(r.igst || 0)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 font-semibold">{formatCurrency(r.total_value || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                      Total ({rows.length} rows)
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatCurrency(totals.taxable)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatCurrency(totals.cgst)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatCurrency(totals.sgst)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatCurrency(totals.igst)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">{formatCurrency(totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Rate-wise (GST slab) subtotals */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">GST Rate Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-zebra">
                <thead>
                  <tr className="border-b border-amber-200 bg-amber-100">
                    <th className="px-3 py-2.5 text-right font-semibold">Rate %</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Taxable</th>
                    <th className="px-3 py-2.5 text-right font-semibold">CGST</th>
                    <th className="px-3 py-2.5 text-right font-semibold">SGST</th>
                    <th className="px-3 py-2.5 text-right font-semibold">IGST</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {slabSummary.map((s) => (
                    <tr key={s.rate} className="border-b border-slate-100">
                      <td className="px-3 py-2.5 text-right font-medium text-slate-800">{s.rate}%</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(s.taxable)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(s.cgst)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(s.sgst)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(s.igst)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 font-semibold">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
