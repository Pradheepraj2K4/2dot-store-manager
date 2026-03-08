import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ledgerApi } from '../../api';

export default function LedgerAutocomplete({ value, onChange, placeholder = 'Search ledger...' }) {
  const [ledgers, setLedgers] = useState([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    ledgerApi.getAll().then((res) => setLedgers(res.data)).catch(() => {});
  }, []);

  const filtered = ledgers.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search) ||
    (l.place || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) setHighlightedIndex(0);
  }, [search, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ledger) => {
    onChange(ledger);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    const totalItems = filtered.length;
    if (totalItems === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightedIndex]) handleSelect(filtered[highlightedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (isOpen && highlightedIndex !== -1 && dropdownRef.current) {
      const highlighted = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlighted?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-2 input-field pr-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate">{value.name}</p>
            <p className="text-xs text-slate-400">
              {value.type_name || ''} · {value.place || 'No location'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="input-field pr-8"
              autoComplete="off"
            />
            <ChevronDownIcon
              className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>

          {isOpen && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-slate-400">
                  {search ? 'No ledgers found' : 'Start typing to search'}
                </div>
              ) : (
                filtered.map((ledger, idx) => (
                  <button
                    key={ledger.id}
                    type="button"
                    data-index={idx}
                    onClick={() => handleSelect(ledger)}
                    className={`w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${idx === highlightedIndex ? 'bg-trust-blue/10' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{ledger.name}</p>
                      <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
                        ledger.behaviour === 'customer' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {ledger.type_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {ledger.phone || 'No phone'} · {ledger.place || 'No location'}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
