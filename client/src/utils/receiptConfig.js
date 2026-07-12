/**
 * Receipt customization config — single source of truth for how sale / invoice
 * receipts are laid out and styled.
 *
 * Two independent designs live side-by-side:
 *   • thermal : a STRUCTURED builder — toggle sections on/off, reorder them,
 *               and tune a few style knobs (fonts, title, footer, dividers).
 *   • paper   : a FREE-HAND builder for A4 / A5 — the branding header band holds
 *               three blocks (logo, store info, invoice meta) that can be placed
 *               anywhere by (x, y, w) in millimetres; the flowing items table,
 *               totals and footer below stay structured but honour style knobs
 *               (accent colour, font family/scale, column visibility, terms,
 *               thanks & signature text, outer border).
 *
 * Persisted inside the server `receipt_config` setting so every device shares
 * the same design. A localStorage mirror keeps the settings live-preview and
 * the print path fast/synchronous.
 */

const RECEIPT_CONFIG_KEY = 'inventory_receipt_config';

// Thermal section catalogue — id → human label. The order/enabled state lives
// in the config; this map only supplies labels for the editor UI.
export const THERMAL_SECTION_LABELS = {
  logo: 'Shop Logo',
  store: 'Store Name & Address',
  title: 'Receipt Title',
  meta: 'Bill Meta (date, party, no.)',
  items: 'Items Table',
  totals: 'Totals & Tax',
  payment: 'Payment Split',
  words: 'Amount in Words',
  notes: 'Notes',
  upiqr: 'UPI Payment QR',
  footer: 'Footer / Thank-you',
};

// Paper (A4/A5) invoice-table column catalogue — id → human label.
export const PAPER_COLUMN_LABELS = {
  sno: 'S.No',
  unit: 'Unit',
  rate: 'Rate',
  discount: 'Discount %',
  gst: 'GST %',
  taxable: 'Taxable Value',
};

export const DEFAULT_RECEIPT_CONFIG = {
  // Default print format used when opening a preview across the app.
  format: 'thermal',

  // ── Back-compat thermal hardware knobs (kept flat; also mirrored below) ──
  thermalWidth: 80,       // mm — printer roll width
  thermalLogoHeight: 12,  // mm — logo print height
  thermalUpiQrSize: 28,   // mm — UPI QR print size

  // ── Structured thermal design ──
  thermal: {
    storeNameSize: 14,   // pt
    baseSize: 9,         // pt — body text
    titleText: 'Retail Invoice',
    footerText: 'Thank you · Visit again',
    showDividers: true,
    sections: [
      { id: 'logo', enabled: true },
      { id: 'store', enabled: true },
      { id: 'title', enabled: true },
      { id: 'meta', enabled: true },
      { id: 'items', enabled: true },
      { id: 'totals', enabled: true },
      { id: 'payment', enabled: true },
      { id: 'words', enabled: true },
      { id: 'notes', enabled: true },
      { id: 'upiqr', enabled: true },
      { id: 'footer', enabled: true },
    ],
  },

  // ── Free-hand paper design (A4 / A5) ──
  paper: {
    accentColor: '#111111',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontScale: 1,         // 0.8 – 1.3 multiplier on base font sizes
    showBorder: true,
    titleText: '',        // '' → use document default (e.g. "Tax Invoice")
    thanksText: 'Thank you for your business',
    termsText: 'Goods once sold will not be taken back or exchanged. All disputes are subject to local jurisdiction.',
    signatureLabel: 'Authorised Signatory',
    showSignature: true,
    showWords: true,
    showTerms: true,
    columns: { sno: true, unit: true, rate: true, discount: true, gst: true, taxable: true },
    // Free-hand branding header. Coordinates are millimetres on an A4 canvas
    // (210mm wide); for A5 they are scaled proportionally (×148/210).
    headerHeight: 40,     // mm — height of the draggable header band
    blocks: {
      logo: { x: 6, y: 6, w: 30, enabled: true },
      store: { x: 42, y: 7, w: 100, align: 'left', enabled: true },
      meta: { x: 150, y: 7, w: 52, align: 'right', enabled: true },
    },
  },
};

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Deep-merge a saved config over the defaults so newly-added keys always exist
// and malformed/partial saved data can never crash a renderer.
export function mergeReceiptConfig(saved) {
  const d = DEFAULT_RECEIPT_CONFIG;
  if (!isObj(saved)) return JSON.parse(JSON.stringify(d));

  const out = JSON.parse(JSON.stringify(d));

  // Flat scalars
  if (['thermal', 'a5', 'a4'].includes(saved.format)) out.format = saved.format;
  ['thermalWidth', 'thermalLogoHeight', 'thermalUpiQrSize'].forEach((k) => {
    const n = Number(saved[k]);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  });

  // Thermal
  if (isObj(saved.thermal)) {
    const t = saved.thermal;
    out.thermal = { ...out.thermal, ...t };
    // Sanitise section list: keep only known ids, preserve saved order, then
    // append any known sections the saved list is missing.
    if (Array.isArray(t.sections)) {
      const known = out.thermal.sections.map((s) => s.id);
      const seen = new Set();
      const merged = [];
      t.sections.forEach((s) => {
        if (s && known.includes(s.id) && !seen.has(s.id)) {
          merged.push({ id: s.id, enabled: s.enabled !== false });
          seen.add(s.id);
        }
      });
      known.forEach((id) => {
        if (!seen.has(id)) merged.push({ id, enabled: true });
      });
      out.thermal.sections = merged;
    } else {
      out.thermal.sections = d.thermal.sections.map((s) => ({ ...s }));
    }
  }

  // Paper
  if (isObj(saved.paper)) {
    const p = saved.paper;
    out.paper = { ...out.paper, ...p };
    out.paper.columns = { ...d.paper.columns, ...(isObj(p.columns) ? p.columns : {}) };
    out.paper.blocks = {
      logo: { ...d.paper.blocks.logo, ...(isObj(p.blocks?.logo) ? p.blocks.logo : {}) },
      store: { ...d.paper.blocks.store, ...(isObj(p.blocks?.store) ? p.blocks.store : {}) },
      meta: { ...d.paper.blocks.meta, ...(isObj(p.blocks?.meta) ? p.blocks.meta : {}) },
    };
  }

  return out;
}

// Read the mirrored config synchronously (used by the print path & preview).
export function getReceiptConfig() {
  try {
    const saved = localStorage.getItem(RECEIPT_CONFIG_KEY);
    if (saved) return mergeReceiptConfig(JSON.parse(saved));
  } catch {
    // ignore corrupt cache
  }
  return JSON.parse(JSON.stringify(DEFAULT_RECEIPT_CONFIG));
}

// Update the localStorage mirror. The authoritative copy is the server
// `receipt_config` setting; callers persist there and mirror here.
export function cacheReceiptConfig(config) {
  try {
    localStorage.setItem(RECEIPT_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore quota / privacy-mode failures
  }
}
