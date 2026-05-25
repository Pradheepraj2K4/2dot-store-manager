import { useEffect, useMemo, useRef } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ITEM_UNITS, DEFAULT_ITEM_UNIT } from '../../utils/itemConstants';
import { formatCurrency } from '../../utils/helpers';
import ItemNameCell from './ItemNameCell';

const FIELD_ORDER = ['itemName', 'unit', 'qty', 'rate', 'discount', 'gst'];

export function emptyLine() {
  return {
    item_id: null,
    item_name: '',
    unit: DEFAULT_ITEM_UNIT,
    mrp: 0,
    rate: '',
    quantity: '1',
    discount_percent: '',
    gst_percent: '',
    amount: 0,
    current_stock: null,
    original_quantity: 0,
  };
}

export function computeAmount({ rate, quantity, discount_percent, gst_percent }) {
  const r = parseFloat(rate) || 0;
  const q = parseFloat(quantity) || 1;
  const d = parseFloat(discount_percent) || 0;
  const g = parseFloat(gst_percent) || 0;
  const taxable = r * q * (1 - d / 100);
  const gst = taxable * g / 100;
  return Math.round((taxable + gst) * 100) / 100;
}

/**
 * Reusable item-line grid used by sales / purchase entry-like pages.
 *
 * Props:
 *  - lines, onLinesChange: controlled array of line objects
 *  - items: list of master items for autocomplete
 *  - onAddNewItem(rowIdx): optional handler for the + button
 *  - stockPolicy:
 *      'deduct' → cap qty at available stock (sales / purchase return)
 *      'add'    → no cap (purchase / sales return / estimation)
 *      'none'   → no cap and no stock warning (estimation if items lack stock)
 *  - showStockWarning: bool — show out-of-stock toast when selecting items
 *  - onToast(type, msg): handler to relay user warnings (toast from caller)
 */
export default function ItemLineGrid({
  lines,
  onLinesChange,
  items,
  onAddNewItem,
  stockPolicy = 'deduct',
  showStockWarning = true,
  onToast,
}) {
  const cellRefs = useRef({});
  const setCellRef = (row, field, ref) => {
    if (!cellRefs.current[row]) cellRefs.current[row] = {};
    cellRefs.current[row][field] = ref;
  };
  const focusCell = (row, field) => {
    const r = cellRefs.current[row]?.[field];
    setTimeout(() => r?.current?.focus(), 0);
  };

  // Keep per-line current_stock in sync when the master items list refreshes
  useEffect(() => {
    if (!items.length) return;
    let changed = false;
    const next = lines.map((l) => {
      if (!l.item_id) return l;
      const item = items.find((it) => it.id === l.item_id);
      if (!item) return l;
      const stock = Number(item.current_stock ?? 0);
      if (l.current_stock === stock) return l;
      changed = true;
      return { ...l, current_stock: stock };
    });
    if (changed) onLinesChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const maxQtyFor = (line) => {
    if (stockPolicy !== 'deduct') return Infinity;
    if (!line.item_id || line.current_stock == null) return Infinity;
    return (parseFloat(line.current_stock) || 0) + (parseFloat(line.original_quantity) || 0);
  };

  const updateLine = (idx, patch) => {
    const next = [...lines];
    const merged = { ...next[idx], ...patch };
    merged.amount = computeAmount(merged);
    next[idx] = merged;
    onLinesChange(next);
  };

  const removeLine = (idx) => {
    if (lines.length <= 1) {
      onLinesChange([emptyLine()]);
      return;
    }
    onLinesChange(lines.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    onLinesChange([...lines, emptyLine()]);
    setTimeout(() => focusCell(lines.length, 'itemName'), 0);
  };

  const handleSelectItem = (idx, item) => {
    const stock = Number(item.current_stock ?? 0);
    if (stockPolicy === 'deduct' && showStockWarning && stock <= 0) {
      onToast && onToast('error', `"${item.name}" is out of stock`);
      return;
    }
    updateLine(idx, {
      item_id: item.id,
      item_name: item.name,
      unit: item.unit || DEFAULT_ITEM_UNIT,
      mrp: item.mrp || 0,
      rate: String(item.mrp || ''),
      quantity: '1',
      gst_percent: item.gst_percent ? String(item.gst_percent) : '',
      current_stock: stock,
      original_quantity: 0,
    });
  };

  const handleQuantityChange = (idx, value) => {
    const line = lines[idx];
    const max = maxQtyFor(line);
    const num = parseFloat(value);
    if (!isNaN(num) && num > max) {
      onToast && onToast('error', `Only ${max} ${line.unit || ''} available in stock`);
      updateLine(idx, { quantity: String(max) });
      return;
    }
    updateLine(idx, { quantity: value });
  };

  const handleCellEnter = (rowIdx, field) => {
    const currentIdx = FIELD_ORDER.indexOf(field);
    if (currentIdx < FIELD_ORDER.length - 1) {
      focusCell(rowIdx, FIELD_ORDER[currentIdx + 1]);
    } else {
      const isLastRow = rowIdx === lines.length - 1;
      if (isLastRow) {
        onLinesChange([...lines, emptyLine()]);
        setTimeout(() => focusCell(rowIdx + 1, 'itemName'), 0);
      } else {
        focusCell(rowIdx + 1, 'itemName');
      }
    }
  };

  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const gstTotal = lines.reduce((s, l) => {
      const r = parseFloat(l.rate) || 0;
      const q = parseFloat(l.quantity) || 1;
      const d = parseFloat(l.discount_percent) || 0;
      const g = parseFloat(l.gst_percent) || 0;
      const taxable = r * q * (1 - d / 100);
      return s + Math.round(taxable * g / 100 * 100) / 100;
    }, 0);
    const discountTotal = lines.reduce((s, l) => {
      const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
      const d = parseFloat(l.discount_percent) || 0;
      return s + gross * d / 100;
    }, 0);
    const lineCount = lines.filter((l) => l.item_name && l.item_name.trim()).length;
    return { total, discountTotal, gstTotal, lineCount };
  }, [lines]);

  return (
    <>
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">S.no</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">Item ID</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 min-w-[18rem]">Item Name</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-28">Unit</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">MRP</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28">Rate</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">Qty</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">Disc %</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">GST %</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28">Amount</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {line.item_id || '—'}
                </td>
                <td className="px-3 py-2">
                  <ItemNameCell
                    value={line.item_name}
                    items={items}
                    onChange={(v) => updateLine(idx, { item_name: v, item_id: null })}
                    onSelect={(it) => handleSelectItem(idx, it)}
                    registerRef={(ref) => setCellRef(idx, 'itemName', ref)}
                    onKeyEnter={() => handleCellEnter(idx, 'itemName')}
                    onAddNew={onAddNewItem ? () => onAddNewItem(idx) : undefined}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    ref={(el) => setCellRef(idx, 'unit', { current: el })}
                    value={line.unit}
                    onChange={(e) => updateLine(idx, { unit: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'unit'); }
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                  >
                    {ITEM_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(line.mrp || 0)}</td>
                <td className="px-3 py-2">
                  <input
                    ref={(el) => setCellRef(idx, 'rate', { current: el })}
                    type="number"
                    step="0.01"
                    value={line.rate}
                    onChange={(e) => updateLine(idx, { rate: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'rate'); }
                    }}
                    className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    ref={(el) => setCellRef(idx, 'qty', { current: el })}
                    type="number"
                    step="0.001"
                    min="0"
                    value={line.quantity}
                    onChange={(e) => handleQuantityChange(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'qty'); }
                    }}
                    className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-1 ${
                      stockPolicy === 'deduct' && line.item_id && parseFloat(line.quantity) > maxQtyFor(line)
                        ? 'border-debit-red focus:border-debit-red focus:ring-debit-red'
                        : 'border-slate-200 focus:border-trust-blue focus:ring-trust-blue'
                    }`}
                    placeholder="1"
                    title={line.item_id && line.current_stock != null ? `In stock: ${line.current_stock}` : undefined}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    ref={(el) => setCellRef(idx, 'discount', { current: el })}
                    type="number"
                    step="0.01"
                    value={line.discount_percent}
                    onChange={(e) => updateLine(idx, { discount_percent: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'discount'); }
                    }}
                    className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    ref={(el) => setCellRef(idx, 'gst', { current: el })}
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.gst_percent}
                    onChange={(e) => updateLine(idx, { gst_percent: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCellEnter(idx, 'gst'); }
                    }}
                    className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  {formatCurrency(line.amount || 0)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title="Remove row"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={addLine}
          className="text-sm text-trust-blue hover:underline flex items-center gap-1"
        >
          <PlusIcon className="h-4 w-4" />
          Add row
        </button>
        <p className="text-xs text-slate-500">
          Tip: press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Enter</kbd> to move between cells.
        </p>
      </div>
    </>
  );
}

// Provide a static helper so callers can compute totals from the same source.
ItemLineGrid.computeTotals = function (lines) {
  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const gstTotal = lines.reduce((s, l) => {
    const r = parseFloat(l.rate) || 0;
    const q = parseFloat(l.quantity) || 1;
    const d = parseFloat(l.discount_percent) || 0;
    const g = parseFloat(l.gst_percent) || 0;
    const taxable = r * q * (1 - d / 100);
    return s + Math.round(taxable * g / 100 * 100) / 100;
  }, 0);
  const discountTotal = lines.reduce((s, l) => {
    const gross = (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 1);
    const d = parseFloat(l.discount_percent) || 0;
    return s + gross * d / 100;
  }, 0);
  const lineCount = lines.filter((l) => l.item_name && l.item_name.trim()).length;
  return { total, discountTotal, gstTotal, lineCount };
};
