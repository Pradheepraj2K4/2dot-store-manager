import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ledgerApi } from '../../api';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function GlobalFinder({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await ledgerApi.getAll({ search: query });
        setResults((res.data || []).slice(0, 10));
        setSelectedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const goTo = (id) => {
    navigate(`/ledger/${id}`);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) goTo(results[selectedIdx].id);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden border border-slate-200 bg-white">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, phone, or ledger ID…"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {loading && (
            <div className="h-4 w-4 rounded-full border-2 border-trust-blue border-t-transparent animate-spin flex-shrink-0" />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {results.map((l, idx) => (
              <li key={l.id}>
                <button
                  data-idx={idx}
                  onClick={() => goTo(l.id)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedIdx === idx
                      ? 'bg-trust-blue text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-sm truncate flex-1">{l.name}</span>
                  {l.phone && (
                    <span className={`text-xs flex-shrink-0 ${selectedIdx === idx ? 'text-blue-100' : 'text-slate-400'}`}>
                      {l.phone}
                    </span>
                  )}
                  <span className={`text-xs font-mono flex-shrink-0 ${selectedIdx === idx ? 'text-blue-200' : 'text-slate-300'}`}>
                    {l.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {query.trim() && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No ledgers found for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Hint bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400">
          <span><kbd className="font-mono bg-white border border-slate-200 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-white border border-slate-200 rounded px-1">↵</kbd> open</span>
          <span><kbd className="font-mono bg-white border border-slate-200 rounded px-1">Esc</kbd> close</span>
          <span className="ml-auto"><kbd className="font-mono bg-white border border-slate-200 rounded px-1">Ctrl+F</kbd> to reopen</span>
        </div>
      </div>
    </div>
  );
}
