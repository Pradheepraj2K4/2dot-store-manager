import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Fixed-slab GST picker used inside the sales / purchase line grids.
 *
 * Presents the statutory GST slabs as a searchable dropdown. The user can
 * type to filter (e.g. "1" narrows to 12 & 18) or pick with the mouse /
 * arrow keys. Selecting a slab reports it back as a string via `onChange`.
 *
 *   <GstSelect
 *      value={line.gst_percent}              // string like '5' or ''
 *      onChange={(pct) => …}                 // '5'
 *      registerRef={(ref) => …}              // Enter-to-next-cell focus mgmt
 *      onKeyEnter={() => …}                  // Enter on last cell adds a row
 *   />
 */

export const GST_RATES = [0, 5, 12, 18, 28];

export default function GstSelect({ value, onChange, registerRef, onKeyEnter }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
        setQuery('');
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
    const q = query.trim();
    if (!q) return GST_RATES;
    return GST_RATES.filter((r) => String(r).includes(q));
  }, [query]);

  useEffect(() => { setHighlight(0); }, [query]);

  const commit = (rate) => {
    onChange(String(rate));
    setOpen(false);
    setQuery('');
  };

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
      if (open && filtered[highlight] !== undefined) {
        commit(filtered[highlight]);
      }
      onKeyEnter && onKeyEnter();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  // When the field is focused/open we let the user type a filter; otherwise
  // we show the committed slab value so the cell reads cleanly.
  const display = open ? query : (value === '' || value == null ? '' : value);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => { setQuery(e.target.value.replace(/[^0-9]/g, '')); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onKeyDown={handleKeyDown}
        placeholder="0"
        className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-trust-blue focus:ring-1 focus:ring-trust-blue"
        autoComplete="off"
      />

      {open && anchorRect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: anchorRect.left,
            width: Math.max(anchorRect.width, 96),
            zIndex: 1000,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-slate-400">No slab</div>
          ) : (
            filtered.map((rate, idx) => (
              <button
                type="button"
                key={rate}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(rate)}
                className={`w-full px-3 py-2 text-right text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  idx === highlight ? 'bg-trust-blue/10' : ''
                } ${String(value) === String(rate) ? 'font-semibold text-trust-blue' : 'text-slate-700'}`}
              >
                {rate}%
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
