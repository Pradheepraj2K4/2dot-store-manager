import { useState, useRef, useEffect, useCallback } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

/**
 * Small "i" button that reveals a list of IMEIs / serial numbers on hover or
 * click. Accepts one or more labelled groups so it can show a single list
 * (e.g. a sale line) or several lists side by side (e.g. purchased / sold /
 * remaining in the stock report).
 *
 * Data can be supplied directly via `groups`, or lazily via `loader` (an async
 * function returning the groups) which is invoked the first time the popover is
 * opened. When `loader` is used the button always renders (the caller decides
 * relevance, e.g. only when an item actually has IMEIs).
 *
 * Props:
 *   groups: [{ label?, items: string[], tone?: 'blue'|'green'|'red'|'slate' }]
 *   loader: async () => groups   (optional, lazy)
 *   title:  heading shown at the top of the popover (optional)
 */
const TONE = {
  blue: 'bg-trust-blue/10 text-trust-blue border-trust-blue/20',
  green: 'bg-credit-green/10 text-credit-green border-credit-green/20',
  red: 'bg-debit-red/10 text-debit-red border-debit-red/20',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ImeiInfoButton({ groups, loader, title }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const sourceGroups = loaded || groups || [];
  const cleanGroups = sourceGroups
    .map((g) => ({ ...g, items: (g.items || []).filter(Boolean) }))
    .filter((g) => g.items.length > 0);

  const total = cleanGroups.reduce((s, g) => s + g.items.length, 0);

  const updateRect = useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, []);

  const runLoader = useCallback(async () => {
    if (!loader || loaded || loading) return;
    setLoading(true);
    try {
      const result = await loader();
      setLoaded(Array.isArray(result) ? result : []);
    } catch {
      setLoaded([]);
    } finally {
      setLoading(false);
    }
  }, [loader, loaded, loading]);

  const show = () => { updateRect(); setOpen(true); runLoader(); };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Without a loader, hide the button entirely when there is nothing to show.
  if (!loader && total === 0) return null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); updateRect(); setOpen((o) => !o); runLoader(); }}
        className="inline-flex items-center justify-center text-slate-400 hover:text-trust-blue focus:outline-none"
        title="Show IMEIs"
        aria-label="Show IMEIs"
      >
        <InformationCircleIcon className="w-4 h-4" />
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
            width: 264,
            zIndex: 1200,
          }}
          className="bg-white rounded-lg border border-slate-200 shadow-lg p-2 text-left"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {title && (
            <div className="px-1 pb-1.5 mb-1 border-b border-slate-100 text-[11px] font-semibold text-slate-600">
              {title}
            </div>
          )}
          {loading ? (
            <div className="px-2 py-3 text-center text-[11px] text-slate-400">Loading…</div>
          ) : total === 0 ? (
            <div className="px-2 py-3 text-center text-[11px] text-slate-400">No IMEIs.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {cleanGroups.map((g, gi) => (
                <div key={g.label || gi}>
                  {g.label && (
                    <div className="flex items-center justify-between px-0.5 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{g.label}</span>
                      <span className="text-[10px] text-slate-400">{g.items.length}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((imei, i) => (
                      <span
                        key={`${imei}-${i}`}
                        className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${TONE[g.tone] || TONE.slate}`}
                      >
                        {imei}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
