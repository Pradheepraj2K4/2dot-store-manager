import { useEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/helpers';

/**
 * Reusable item-search input used inside ItemLineGrid rows.
 *
 *   <ItemNameCell
 *      value={line.item_name}
 *      items={allItems}
 *      onChange={(name) => …}
 *      onSelect={(item) => …}
 *      registerRef={(ref) => …}     // for Enter-to-next-cell focus mgmt
 *      onKeyEnter={() => …}
 *      onAddNew={() => …}            // + button click
 *   />
 */
export default function ItemNameCell({
  value,
  items,
  onSelect,
  onChange,
  registerRef,
  onKeyEnter,
  onAddNew,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [anchorRect, setAnchorRect] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (registerRef) registerRef(inputRef);
  }, [registerRef]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (inputRef.current) setAnchorRect(inputRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = (value || '').toLowerCase().trim();
    if (!q) return items.slice(0, 20);
    return items
      .filter((it) =>
        it.name.toLowerCase().includes(q) ||
        (it.item_code || '').toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [items, value]);

  useEffect(() => { setHighlight(0); }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) {
        onSelect(filtered[highlight]);
        setOpen(false);
      }
      onKeyEnter && onKeyEnter();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by code, name, brand, category…"
          className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
          autoComplete="off"
        />
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            title="Create new item"
            className="flex h-7 w-7 items-center justify-center rounded bg-trust-blue/10 text-trust-blue hover:bg-trust-blue/20 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && anchorRect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: anchorRect.left,
            width: Math.max(anchorRect.width, 320),
            zIndex: 1000,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-slate-400">
              No items match.{onAddNew ? ' Use the + button to create one.' : ''}
            </div>
          ) : (
            filtered.map((it, idx) => (
              <button
                type="button"
                key={it.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(it); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  idx === highlight ? 'bg-trust-blue/10' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 truncate">
                    {it.item_code ? (
                      <span className="mr-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 align-middle">
                        {it.item_code}
                      </span>
                    ) : null}
                    {it.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">#{it.id}</span>
                </div>
                <div className="text-xs text-slate-500 truncate flex items-center justify-between">
                  <span className="truncate">
                    {[it.brand, it.category].filter(Boolean).join(' · ') || '—'}
                    <span className="ml-2 text-slate-400">{formatCurrency(it.mrp)}</span>
                  </span>
                  <span className="ml-2 whitespace-nowrap">
                    Stock: <span className={Number(it.current_stock) <= 0 ? 'text-debit-red font-medium' : 'text-credit-green font-medium'}>
                      {Number(it.current_stock || 0)}
                    </span>
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
