import { useEffect, useMemo, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/helpers';

/**
 * Searchable single-item picker for the service forms. Lets the operator pick
 * one item from the saved-items master. Calls `onChange({ id, name })` (or null
 * when cleared).
 */
export default function ServiceItemSelect({ items, value, onChange, autoFocus = false }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items.slice(0, 30);
    return items
      .filter((it) =>
        it.name.toLowerCase().includes(q) ||
        (it.item_code || '').toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [items, search]);

  useEffect(() => { setHighlight(0); }, [search]);

  const select = (it) => {
    onChange({ id: it.id, name: it.name });
    setSearch('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        select(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (value && value.id) {
    return (
      <div className="relative input-field pr-8 flex items-center gap-1.5">
        <span className="font-medium text-slate-800 truncate">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search item by name, code, brand…"
        className="input-field"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-slate-400">No items found</div>
          ) : (
            filtered.map((it, idx) => (
              <button
                type="button"
                key={it.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(it)}
                className={`w-full px-3 py-2 text-left text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  idx === highlight ? 'bg-trust-blue/10' : ''
                }`}
              >
                <div className="flex items-center gap-3 whitespace-nowrap">
                  {it.item_code ? (
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{it.item_code}</span>
                  ) : null}
                  <span className="font-medium text-slate-800">{it.name}</span>
                  <span className="text-xs text-slate-400">{[it.brand, it.category].filter(Boolean).join(' · ')}</span>
                  <span className="text-xs text-slate-500 ml-auto">{formatCurrency(it.mrp)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
