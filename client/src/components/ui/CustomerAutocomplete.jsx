import { useState, useRef, useEffect, forwardRef } from 'react';
import { customerApi } from '../../api';

/**
 * Customer combobox used in entry screens.
 *
 * Unlike a strict picker, the typed text is always treated as the customer
 * name (free-text walk-in), while existing customers are surfaced as
 * suggestions matched by name or mobile. Picking a suggestion fills the
 * buyer's details; the backend then decides "new vs existing" implicitly by
 * mobile number — the user never has to.
 */
const CustomerAutocomplete = forwardRef(function CustomerAutocomplete(
  { value, onChange, onSelect, placeholder = 'Customer name', onKeyDownExtra },
  ref
) {
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    customerApi.getAll({ status: 'active' })
      .then((res) => setCustomers(res.data || []))
      .catch(() => {});
  }, []);

  const q = (value || '').toLowerCase();
  const filtered = !q
    ? customers.slice(0, 8)
    : customers.filter((c) =>
        c.name.toLowerCase().includes(q) || (c.mobile || '').includes(value || '')
      ).slice(0, 8);

  useEffect(() => { setHighlighted(0); }, [value, open]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const pick = (c) => {
    onSelect?.(c);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((p) => (p + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((p) => (p - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' && filtered[highlighted]) {
        // Only hijack Enter when a suggestion is actively highlighted.
        e.preventDefault();
        pick(filtered[highlighted]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    onKeyDownExtra?.(e);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={ref}
        type="text"
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-field"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              data-index={idx}
              onClick={() => pick(c)}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${idx === highlighted ? 'bg-trust-blue/10' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                <span className="text-xs text-slate-500 font-mono shrink-0">{c.mobile || '—'}</span>
              </div>
              {c.place ? <p className="text-xs text-slate-400 truncate">{c.place}</p> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default CustomerAutocomplete;
