/**
 * Sale / Invoice Receipt printer
 *
 * Generates a print-ready HTML page for an item sale.
 * `format`: 'a5' | 'a4' | 'thermal'
 *
 *  - thermal : 80mm POS roll — STRUCTURED design. Sections can be toggled and
 *              reordered, with a few style knobs (fonts, title, footer text).
 *  - a4 / a5 : standard tax invoice — FREE-HAND branding header (logo / store /
 *              invoice-meta blocks placed by mm coordinates) over a structured
 *              flowing items table + totals + footer with style knobs
 *              (accent colour, font scale, column visibility, terms/thanks).
 *
 * The look is driven by the receipt config (see utils/receiptConfig.js); when
 * no config is supplied the built-in defaults are used so every call site keeps
 * working unchanged.
 */

import qrcode from 'qrcode-generator';
import { mergeReceiptConfig } from './receiptConfig';

// Builds a UPI payment QR code as a data URL for the given VPA (UPI id).
// Returns null when no valid UPI id is supplied. Fully synchronous so it can
// be embedded directly in the receipt HTML string.
function buildUpiQrDataUrl(upiId, { payeeName = '', amount = 0 } = {}) {
  const vpa = String(upiId || '').trim();
  if (!vpa) return null;
  try {
    const params = [`pa=${encodeURIComponent(vpa)}`];
    if (payeeName) params.push(`pn=${encodeURIComponent(payeeName)}`);
    const amt = parseFloat(amount);
    if (Number.isFinite(amt) && amt > 0) params.push(`am=${amt.toFixed(2)}`);
    params.push('cu=INR');
    const upiUri = `upi://pay?${params.join('&')}`;
    const qr = qrcode(0, 'M');
    qr.addData(upiUri);
    qr.make();
    // cellSize/margin in module units; the CSS width scales it to the desired mm.
    return qr.createDataURL(4, 0);
  } catch (_) {
    return null;
  }
}

function fmt(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

// Reference-style date: dd/mm/yyyy
function fmtDMY(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

// Convert 24-hour "HH:MM" to 12-hour "hh:mm AM/PM".
function fmt12(time) {
  if (!time) return '';
  const [hStr, mStr] = String(time).split(':');
  let h = parseInt(hStr, 10);
  const m = (mStr || '00').padStart(2, '0');
  if (isNaN(h)) return escapeHtml(time);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function money(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function num(n, decimals = 2) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n ?? 0);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// Convert paise integer-rounded amount to Indian-style words.
function amountInWords(n) {
  const num = Math.round((parseFloat(n) || 0) * 100) / 100;
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const sub = (x) => {
    if (x < 20) return ones[x];
    if (x < 100) return (tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '')).trim();
    return (ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + sub(x % 100) : '')).trim();
  };
  const inWords = (x) => {
    if (x === 0) return 'Zero';
    const cr = Math.floor(x / 10000000); x %= 10000000;
    const lk = Math.floor(x / 100000);   x %= 100000;
    const th = Math.floor(x / 1000);     x %= 1000;
    const hu = x;
    return [
      cr ? sub(cr) + ' Crore' : '',
      lk ? sub(lk) + ' Lakh'  : '',
      th ? sub(th) + ' Thousand' : '',
      hu ? sub(hu) : '',
    ].filter(Boolean).join(' ').trim();
  };
  let out = `Rupees ${inWords(rupees)}`;
  if (paise) out += ` and ${inWords(paise)} Paise`;
  return out + ' Only';
}

const PAGE_SIZES = {
  a5:      { cssSize: 'A5',        width: '148mm' },
  a4:      { cssSize: 'A4',        width: '210mm' },
  thermal: { cssSize: '80mm auto', width: '76mm'  },
};

// Document-type label sets. `sale` renders a tax invoice; `estimation`
// renders a non-posting quotation/estimate with the same layout.
const DOC_LABELS = {
  sale: {
    title: 'Tax Invoice',
    numberLabelThermal: 'Bill No.',
    numberLabelPaper: 'Invoice No.',
    dateLabelPaper: 'Invoice Date',
    docWord: 'Invoice',
    thanks: 'Thank you for your business',
    thanksThermal: 'Thank you · Visit again',
    terms: 'Goods once sold will not be taken back or exchanged. All disputes are subject to local jurisdiction.',
  },
  estimation: {
    title: 'Estimate',
    numberLabelThermal: 'Estimate No.',
    numberLabelPaper: 'Estimate No.',
    dateLabelPaper: 'Estimate Date',
    docWord: 'Estimate',
    thanks: 'This is an estimate — not a tax invoice',
    thanksThermal: 'Estimate · Not a tax invoice',
    terms: 'This is an estimate and not a tax invoice. Prices are subject to change and stock availability.',
  },
};

export function buildSaleReceiptHtml({
  sale,
  ledgerName, // unused for non-CASH; customer comes from sale.customer_name
  store = {},
  logoDataUrl = null,
  format = 'thermal',
  docType = 'sale',
  config = null, // receipt customization config (see utils/receiptConfig.js)
  logoHeightMm = null, // optional override for the thermal logo height (mm)
  upiQrSizeMm = null, // optional override for the thermal UPI QR size (mm)
  widthMm = null, // optional override for the thermal paper width (mm)
}) {
  const ps = PAGE_SIZES[format] || PAGE_SIZES.thermal;
  const isThermal = format === 'thermal';
  const labels = DOC_LABELS[docType] || DOC_LABELS.sale;
  const cfg = mergeReceiptConfig(config);

  if (isThermal) return buildThermal({ sale, ledgerName, store, logoDataUrl, ps, labels, docType, cfg, logoHeightMm, upiQrSizeMm, widthMm });
  return buildPaper({ sale, store, logoDataUrl, ps, format, labels, cfg });
}

// ───────────────────────────────────────────────────────────────────────────
// Thermal (80mm) — POS-style STRUCTURED receipt (toggle + reorder sections)
// ───────────────────────────────────────────────────────────────────────────
function buildThermal({ sale, ledgerName, store, logoDataUrl, ps, labels, docType, cfg, logoHeightMm = null, upiQrSizeMm = null, widthMm = null }) {
  const cfgT = cfg.thermal;
  const items = Array.isArray(sale.items) ? sale.items : [];
  const totalQty          = items.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalItemDiscount = parseFloat(sale.total_discount) || 0;
  const totalBillDiscount = parseFloat(sale.bill_discount) || 0;
  const totalAmount       = parseFloat(sale.total_amount) || 0;
  const cashAmt           = parseFloat(sale.cash_amount) || 0;
  const upiAmt            = parseFloat(sale.upi_amount) || 0;
  const tenderedAmt       = parseFloat(sale.tendered_amount) || 0;
  const changeAmt         = Math.max(0, tenderedAmt - cashAmt);

  // Thermal logo height (mm): explicit override → config → 12mm.
  const resolvedLogoHeight =
    (typeof logoHeightMm === 'number' && logoHeightMm > 0)
      ? logoHeightMm
      : (parseFloat(store?.thermal_logo_height) || parseFloat(cfg.thermalLogoHeight) || 12);

  // Thermal UPI QR size (mm): explicit override → config → 28mm.
  const resolvedUpiQrSize =
    (typeof upiQrSizeMm === 'number' && upiQrSizeMm > 0)
      ? upiQrSizeMm
      : (parseFloat(store?.thermal_upi_qr_size) || parseFloat(cfg.thermalUpiQrSize) || 28);

  // Build the UPI payment QR (embeds the bill amount) when a UPI id is set.
  const upiQrDataUrl = buildUpiQrDataUrl(store?.upi_id, {
    payeeName: store?.store_name || '',
    amount: totalAmount,
  });

  // Thermal paper width (mm): explicit override → config → 80mm. Clamped 50–80.
  const rawWidth =
    (typeof widthMm === 'number' && widthMm > 0)
      ? widthMm
      : (parseFloat(store?.thermal_width) || parseFloat(cfg.thermalWidth) || 80);
  const paperWidth = Math.min(80, Math.max(50, rawWidth));
  const thermalPageSize = `${paperWidth}mm auto`;
  const thermalBodyWidth = `${paperWidth - 4}mm`;

  // Style knobs
  const storeNameSize = Math.min(24, Math.max(9, parseFloat(cfgT.storeNameSize) || 14));
  const baseSize = Math.min(13, Math.max(7, parseFloat(cfgT.baseSize) || 9));

  // Gross before any discount = Σ(rate × qty).
  const grossBeforeDisc = items.reduce((s, l) => {
    return s + (parseFloat(l.rate) || 0) * (parseFloat(l.quantity) || 0);
  }, 0);
  const totalDiscount = totalItemDiscount + totalBillDiscount;

  const gstSlabs = {};
  items.forEach(l => {
    const rate = parseFloat(l.gst_percent) || 0;
    if (rate > 0) {
      gstSlabs[rate] = (gstSlabs[rate] || 0) + (parseFloat(l.gst_amount) || 0);
    }
  });
  const gstSlabRows = Object.entries(gstSlabs)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([rate, amt]) => {
      const halfAmt = Math.round(amt / 2 * 100) / 100;
      const halfPct = parseFloat(rate) / 2;
      return `<div class="trow"><span class="tl">CGST @ ${num(halfPct, 2)}%</span><span class="tr">${num(halfAmt, 2)}</span></div>` +
             `<div class="trow"><span class="tl">SGST @ ${num(halfPct, 2)}%</span><span class="tr">${num(halfAmt, 2)}</span></div>`;
    }).join('');

  const payMode = (cashAmt > 0 && upiAmt > 0)
    ? 'CASH+UPI'
    : (upiAmt > 0 ? 'UPI' : 'Cash');

  const thermalTitle = docType === 'sale'
    ? (cfgT.titleText || 'Retail Invoice')
    : labels.title;
  const thermalFooter = cfgT.footerText || labels.thanksThermal;

  const itemsRows = items.map((l) => {
    const qty = parseFloat(l.quantity) || 0;
    return `
      <div class="trow item">
        <span class="c-item">${escapeHtml(l.item_name || '')}</span>
        <span class="c-qty">${num(qty, qty % 1 === 0 ? 0 : 2)}</span>
        <span class="c-amt">${num(l.amount, 2)}</span>
      </div>`;
  }).join('');

  // ── Build each section's HTML, then assemble in the configured order ──
  const parts = {
    logo: logoDataUrl ? `<div class="logo-wrap"><img src="${logoDataUrl}" alt="Logo"/></div>` : '',
    store: `
      <div class="header">
        <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
        <div class="store-meta">
          ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
          ${store.place ? `${escapeHtml(store.place)}<br>` : ''}
          ${store.phone ? `PHONE : ${escapeHtml(store.phone)}` : ''}${store.phone && store.email ? '<br>' : ''}${store.email ? escapeHtml(store.email) : ''}
          ${store.gst_tax_id ? `<br>GSTIN : ${escapeHtml(store.gst_tax_id)}` : ''}
        </div>
      </div>`,
    title: `<div class="title">${escapeHtml(thermalTitle)}</div>`,
    meta: `
      <div class="meta">
        <div class="line">Date : ${fmtDMY(sale.date)}${sale.time ? ', ' + fmt12(sale.time) : ''}</div>
        ${sale.customer_name && sale.customer_name.trim() ? `<div class="party">${escapeHtml(sale.customer_name.trim())}</div>` : ''}
        <div class="line">${escapeHtml(labels.numberLabelThermal)} : ${escapeHtml(sale.sale_number || '—')}</div>
        <div class="line">Payment Mode : ${payMode}</div>
        ${sale.service_type ? `<div class="line">Dining : ${sale.service_type === 'ac' ? 'A/C' : 'Non-A/C'}</div>` : ''}
        ${sale.waiter_name && sale.waiter_name.trim() ? `<div class="line">Waiter : ${escapeHtml(sale.waiter_name.trim())}</div>` : ''}
      </div>`,
    items: `
      <div class="items-head trow">
        <span class="c-item">Item</span>
        <span class="c-qty">Qty</span>
        <span class="c-amt">Amt</span>
      </div>
      <div class="rule-solid"></div>
      ${itemsRows}
      <div class="rule-solid"></div>
      <div class="trow sub">
        <span class="c-item">Sub Total</span>
        <span class="c-qty">${num(totalQty, totalQty % 1 === 0 ? 0 : 2)}</span>
        <span class="c-amt">${num(grossBeforeDisc, 2)}</span>
      </div>`,
    totals: `
      <div class="totals">
        ${totalDiscount > 0 ? `<div class="trow disc"><span class="tl">(-) Discount</span><span class="tr">${num(totalDiscount, 2)}</span></div>` : ''}
        <div class="gst">${gstSlabRows}</div>
      </div>
      <div class="grand">
        <span>TOTAL</span>
        <span class="g-amt">Rs ${num(totalAmount, 2)}</span>
      </div>`,
    payment: `
      <div class="pay">
        ${cashAmt > 0 ? `<div class="trow"><span class="tl">Cash :</span><span class="tr">Rs ${num(cashAmt, 2)}</span></div>` : ''}
        ${upiAmt > 0 ? `<div class="trow"><span class="tl">UPI :</span><span class="tr">Rs ${num(upiAmt, 2)}</span></div>` : ''}
        ${tenderedAmt > 0 ? `<div class="trow"><span class="tl">Cash tendered :</span><span class="tr">Rs ${num(tenderedAmt, 2)}</span></div>` : ''}
        ${changeAmt > 0 ? `<div class="trow"><span class="tl">Change / Return :</span><span class="tr">Rs ${num(changeAmt, 2)}</span></div>` : ''}
      </div>`,
    words: `<div class="words">${escapeHtml(amountInWords(totalAmount))}</div>`,
    notes: sale.notes ? `<div class="notes"><span class="lbl">Notes:</span> ${escapeHtml(sale.notes)}</div>` : '',
    upiqr: upiQrDataUrl ? `
      <div class="upi-qr">
        <img src="${upiQrDataUrl}" alt="UPI QR"/>
        <div class="upi-label">Scan &amp; Pay via UPI</div>
        <div class="upi-vpa">${escapeHtml(store.upi_id)}</div>
      </div>` : '',
    footer: `
      <div class="footer">
        <div class="eoe">E &amp; O E</div>
        <div class="thanks">${escapeHtml(thermalFooter)}</div>
      </div>`,
  };

  const sections = Array.isArray(cfgT.sections) && cfgT.sections.length
    ? cfgT.sections
    : mergeReceiptConfig(null).thermal.sections;
  const dividerBefore = new Set(['meta', 'items', 'upiqr']);
  let bodyHtml = '';
  let emitted = false;
  sections.forEach((s) => {
    if (!s || s.enabled === false) return;
    const html = parts[s.id];
    if (!html) return;
    if (cfgT.showDividers !== false && dividerBefore.has(s.id) && emitted) {
      bodyHtml += '<div class="rule-dash"></div>';
    }
    bodyHtml += html;
    emitted = true;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${labels.docWord} ${sale.sale_number || ''}</title>
  <style>
    @page { size: ${thermalPageSize}; margin: 3mm 2mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body, body * { color: #000 !important; background: transparent !important; border-color: #000 !important; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: ${baseSize}pt;
      line-height: 1.4;
      width: ${thermalBodyWidth};
      filter: grayscale(100%);
      -webkit-filter: grayscale(100%);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
    .page { width: 100%; padding: 1mm 2mm; }

    .logo-wrap { text-align: center; margin-bottom: 1.5mm; }
    .logo-wrap img { max-height: ${resolvedLogoHeight}mm; max-width: 100%; object-fit: contain; filter: grayscale(100%) contrast(1.15); }

    .upi-qr { text-align: center; margin-top: 2mm; }
    .upi-qr img { width: ${resolvedUpiQrSize}mm; height: ${resolvedUpiQrSize}mm; image-rendering: pixelated; }
    .upi-qr .upi-label { font-size: 8pt; font-weight: 700; margin-top: 0.8mm; letter-spacing: 0.3px; }
    .upi-qr .upi-vpa { font-size: 7.5pt; margin-top: 0.2mm; word-break: break-all; }

    .header { text-align: center; }
    .store-name { font-size: ${storeNameSize}pt; font-weight: 800; letter-spacing: 0.3px; }
    .store-meta { font-size: 8pt; margin-top: 0.6mm; line-height: 1.4; }

    .title {
      text-align: center;
      font-weight: 800;
      font-size: ${Math.min(20, storeNameSize - 3)}pt;
      margin: 1.5mm 0 1mm;
    }

    .rule-dash  { border-top: 1px dashed #000; margin: 1mm 0; }
    .rule-solid { border-top: 1px solid #000;  margin: 0.8mm 0; }

    .meta { font-size: ${baseSize}pt; }
    .meta .line { padding: 0.15mm 0; }
    .meta .party { font-weight: 800; font-size: ${baseSize + 0.5}pt; padding: 0.4mm 0; }

    .trow {
      display: flex;
      align-items: baseline;
      font-size: ${baseSize}pt;
      padding: 0.3mm 0;
    }
    .c-item, .tl { flex: 1; word-break: break-word; padding-right: 1.5mm; }
    .c-qty { width: 9mm; text-align: center; white-space: nowrap; }
    .c-amt, .tr { width: 20mm; text-align: right; white-space: nowrap; }

    .items-head { font-weight: 800; }

    .trow.sub { font-weight: 700; }
    .trow.disc .tl,
    .trow.disc .tr { font-weight: 600; }
    .gst .tl, .gst .tr { font-size: 8pt; }

    .grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 900;
      font-size: ${baseSize + 3.5}pt;
      padding: 1.2mm 0;
      margin: 0.8mm 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .grand .g-amt { white-space: nowrap; }

    .pay { font-size: ${baseSize}pt; }
    .pay .trow { padding: 0.2mm 0; }

    .words {
      margin-top: 1.2mm;
      font-size: 8pt;
      font-style: italic;
      text-align: center;
      line-height: 1.35;
    }

    .notes {
      margin-top: 1mm;
      font-size: 8pt;
      line-height: 1.35;
    }
    .notes .lbl { font-weight: 700; }

    .footer {
      margin-top: 2mm;
      font-size: 8pt;
      line-height: 1.4;
    }
    .eoe { text-align: right; font-style: italic; }
    .thanks { text-align: center; margin-top: 1mm; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  </style>
</head>
<body>
<div class="page">
  ${bodyHtml}
</div>
<script>
(function () {
  var b = document.body, fe = window.frameElement;
  function fit() {
    if (!fe) return;
    b.style.transformOrigin = 'top left';
    b.style.transform = 'none';
    var avail = fe.clientWidth || fe.offsetWidth || b.scrollWidth;
    var bw = b.scrollWidth || 1;
    var s = bw > avail ? avail / bw : 1;
    if (s < 1) b.style.transform = 'scale(' + s + ')';
    fe.style.height = Math.min(Math.ceil(b.scrollHeight * s) + 6, 620) + 'px';
  }
  addEventListener('load', function () { fit(); setTimeout(fit, 0); setTimeout(fit, 60); });
  addEventListener('resize', fit);
  addEventListener('beforeprint', function () { b.style.transform = 'none'; });
  addEventListener('afterprint', fit);
})();
</script>
</body>
</html>`;
}

// ───────────────────────────────────────────────────────────────────────────
// A4 / A5 — FREE-HAND branding header + structured tax invoice
// ───────────────────────────────────────────────────────────────────────────
function buildPaper({ sale, store, logoDataUrl, ps, format, labels, cfg }) {
  const isA5 = format === 'a5';
  const cfgP = cfg.paper;
  const items = Array.isArray(sale.items) ? sale.items : [];

  const totalItemDiscount = parseFloat(sale.total_discount) || 0;
  const totalBillDiscount = parseFloat(sale.bill_discount) || 0;
  const totalAmount       = parseFloat(sale.total_amount) || 0;
  const cashAmt           = parseFloat(sale.cash_amount) || 0;
  const upiAmt            = parseFloat(sale.upi_amount) || 0;
  const tenderedAmt       = parseFloat(sale.tendered_amount) || 0;
  const changeAmt         = Math.max(0, tenderedAmt - cashAmt);

  const subtotal = items.reduce((s, l) => {
    const rate = parseFloat(l.rate) || 0;
    const qty  = parseFloat(l.quantity) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    return s + rate * qty * (1 - disc / 100);
  }, 0);

  const gstSlabs = {};
  items.forEach(l => {
    const rate = parseFloat(l.gst_percent) || 0;
    if (rate > 0) {
      gstSlabs[rate] = (gstSlabs[rate] || 0) + (parseFloat(l.gst_amount) || 0);
    }
  });
  const gstSlabRows = Object.entries(gstSlabs)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([rate, amt]) => {
      const halfAmt = Math.round(amt / 2 * 100) / 100;
      const halfPct = parseFloat(rate) / 2;
      return `<tr><td>CGST @ ${halfPct}%</td><td class="r">${money(halfAmt)}</td></tr>` +
             `<tr><td>SGST @ ${halfPct}%</td><td class="r">${money(halfAmt)}</td></tr>`;
    }).join('');

  // ── Style tokens ──
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(cfgP.accentColor || '') ? cfgP.accentColor : '#111111';
  const fontFamily = cfgP.fontFamily || "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const F = Math.min(1.3, Math.max(0.8, parseFloat(cfgP.fontScale) || 1));
  const pt = (v) => `${+(v * F).toFixed(2)}pt`;
  const showBorder = cfgP.showBorder !== false;

  const baseFs   = isA5 ? pt(9)   : pt(10.5);
  const titleFs  = isA5 ? pt(15)  : pt(20);
  const headFs   = isA5 ? pt(8.5) : pt(9.5);
  const grandFs  = isA5 ? pt(12)  : pt(14);
  const metaTitleFs = isA5 ? pt(11) : pt(13);
  const metaFs   = isA5 ? pt(8.5) : pt(9.5);
  const storeMetaFs = isA5 ? pt(8) : pt(9);
  const partyNameFs = isA5 ? pt(10.5) : pt(12);

  const paperTitle = cfgP.titleText && cfgP.titleText.trim() ? cfgP.titleText.trim() : labels.title;
  const thanksText = cfgP.thanksText && cfgP.thanksText.trim() ? cfgP.thanksText.trim() : labels.thanks;
  const termsText  = cfgP.termsText && cfgP.termsText.trim() ? cfgP.termsText.trim() : labels.terms;
  const signatureLabel = cfgP.signatureLabel && cfgP.signatureLabel.trim() ? cfgP.signatureLabel.trim() : 'Authorised Signatory';

  // ── Free-hand header band ──
  const widthFactor = isA5 ? 148 / 210 : 1;
  const sc = (v) => +((parseFloat(v) || 0) * widthFactor).toFixed(2);
  const headerHeight = Math.min(90, Math.max(18, parseFloat(cfgP.headerHeight) || 40));
  const blocks = cfgP.blocks || {};

  // Auto-grow the header band so absolutely-positioned blocks never overflow onto the table.
  const MM_PER_PT = 0.3528;
  const metaRowCount = 3
    + (sale.service_type ? 1 : 0)
    + (sale.waiter_name && sale.waiter_name.trim() ? 1 : 0);
  const metaContentMm =
    (isA5 ? 11 : 13) * F * MM_PER_PT * 1.25 + 2 +
    metaRowCount * (isA5 ? 8.5 : 9.5) * F * MM_PER_PT * 1.6;
  const metaNeededMm = (blocks.meta?.enabled !== false ? (parseFloat(blocks.meta?.y) || 0) + metaContentMm + 3 : 0);
  let storeMetaLines = 0;
  if (store.address) storeMetaLines += String(store.address).split('\n').length;
  if (store.place) storeMetaLines += 1;
  if (store.phone) storeMetaLines += 1;
  if (store.email) storeMetaLines += 1;
  if (store.gst_tax_id) storeMetaLines += 1;
  const storeContentMm =
    (isA5 ? 15 : 20) * F * MM_PER_PT * 1.15 + 1.5 +
    storeMetaLines * (isA5 ? 8 : 9) * F * MM_PER_PT * 1.45;
  const storeNeededMm = (blocks.store?.enabled !== false ? (parseFloat(blocks.store?.y) || 0) + storeContentMm + 3 : 0);
  const bandHeight = Math.max(headerHeight, metaNeededMm, storeNeededMm);

  const logoBlock = (blocks.logo?.enabled !== false && logoDataUrl)
    ? `<div class="hblk" style="left:${sc(blocks.logo.x)}mm;top:${blocks.logo.y}mm;width:${sc(blocks.logo.w)}mm;">
         <img class="logo" src="${logoDataUrl}" alt="Logo"/>
       </div>`
    : '';

  const storeBlock = (blocks.store?.enabled !== false)
    ? `<div class="hblk" style="left:${sc(blocks.store.x)}mm;top:${blocks.store.y}mm;width:${sc(blocks.store.w)}mm;text-align:${blocks.store.align || 'left'};">
         <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
         <div class="store-meta">
           ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
           ${store.place ? `${escapeHtml(store.place)}<br>` : ''}
           ${store.phone ? `Phone: ${escapeHtml(store.phone)}<br>` : ''}
           ${store.email ? `Email: ${escapeHtml(store.email)}<br>` : ''}
           ${store.gst_tax_id ? `GSTIN: ${escapeHtml(store.gst_tax_id)}` : ''}
         </div>
       </div>`
    : '';

  const metaBlock = (blocks.meta?.enabled !== false)
    ? `<div class="hblk" style="left:${sc(blocks.meta.x)}mm;top:${blocks.meta.y}mm;width:${sc(blocks.meta.w)}mm;text-align:${blocks.meta.align || 'right'};">
         <div class="doc-title">${escapeHtml(paperTitle)}</div>
         <div class="doc-meta">
           <div><span class="lbl">${escapeHtml(labels.numberLabelPaper)}</span><span class="val">${escapeHtml(sale.sale_number || '—')}</span></div>
           <div><span class="lbl">${escapeHtml(labels.dateLabelPaper)}</span><span class="val">${fmt(sale.date)}${sale.time ? ' · ' + escapeHtml(sale.time) : ''}</span></div>
           <div><span class="lbl">Items</span><span class="val">${items.length}</span></div>
           ${sale.service_type ? `<div><span class="lbl">Dining</span><span class="val">${sale.service_type === 'ac' ? 'A/C' : 'Non-A/C'}</span></div>` : ''}
           ${sale.waiter_name && sale.waiter_name.trim() ? `<div><span class="lbl">Waiter</span><span class="val">${escapeHtml(sale.waiter_name.trim())}</span></div>` : ''}
         </div>
       </div>`
    : '';

  const customerBlock = sale.customer_name && sale.customer_name.trim()
    ? `<div class="party">
         <div class="party-title">Bill To</div>
         <div class="party-name">${escapeHtml(sale.customer_name.trim())}</div>
       </div>`
    : '';

  // ── Configurable item-table columns ──
  const colDefs = [
    { id: 'sno',     always: false, th: '#',       thc: 'c', w: isA5 ? '8mm'  : '10mm', cell: (l, i) => `<td class="c">${i + 1}</td>` },
    { id: 'name',    always: true,  th: 'Item',    thc: '',  w: 'auto',                 cell: (l) => `<td class="nm">${escapeHtml(l.item_name || '')}</td>` },
    { id: 'unit',    always: false, th: 'Unit',    thc: 'c', w: isA5 ? '12mm' : '15mm', cell: (l) => `<td class="c">${escapeHtml(l.unit || '')}</td>` },
    { id: 'qty',     always: true,  th: 'Qty',     thc: 'r', w: isA5 ? '14mm' : '18mm', cell: (l) => { const q = parseFloat(l.quantity) || 0; return `<td class="r">${num(q, q % 1 === 0 ? 0 : 2)}</td>`; } },
    { id: 'rate',    always: false, th: 'Rate',    thc: 'r', w: isA5 ? '20mm' : '24mm', cell: (l) => `<td class="r">${money(parseFloat(l.rate) || 0)}</td>` },
    { id: 'discount',always: false, th: 'Disc',    thc: 'r', w: isA5 ? '14mm' : '16mm', cell: (l) => { const d = parseFloat(l.discount_percent) || 0; return `<td class="r">${d ? num(d, 0) + '%' : '—'}</td>`; } },
    { id: 'gst',     always: false, th: 'GST',     thc: 'r', w: isA5 ? '14mm' : '16mm', cell: (l) => { const g = parseFloat(l.gst_percent) || 0; return `<td class="r">${g ? num(g, 0) + '%' : '—'}</td>`; } },
    { id: 'taxable', always: false, th: 'Taxable', thc: 'r', w: isA5 ? '22mm' : '26mm', cell: (l) => { const rate = parseFloat(l.rate) || 0, q = parseFloat(l.quantity) || 0, d = parseFloat(l.discount_percent) || 0; return `<td class="r">${money(rate * q * (1 - d / 100))}</td>`; } },
    { id: 'amount',  always: true,  th: 'Amount',  thc: 'r', w: isA5 ? '24mm' : '30mm', cell: (l) => `<td class="r">${money(l.amount)}</td>` },
  ];
  const cols = colDefs.filter((c) => c.always || cfgP.columns?.[c.id] !== false);
  const colGroupHtml = cols.map((c) => `<col style="width:${c.w}"/>`).join('');
  const theadHtml = cols.map((c) => `<th class="${c.thc}">${c.th}</th>`).join('');
  const itemsRows = items.map((l, i) => `<tr>${cols.map((c) => c.cell(l, i)).join('')}</tr>`).join('');

  // ── Footer columns (terms / signature) ──
  const footCols = [];
  if (cfgP.showTerms !== false) {
    footCols.push(`<div class="col terms"><span class="lbl">Terms &amp; Conditions</span>${escapeHtml(termsText)}</div>`);
  }
  if (cfgP.showSignature !== false) {
    footCols.push(`<div class="col sig"><span class="lbl">For ${escapeHtml(store.store_name || 'Store')}</span><div class="sig-line">${escapeHtml(signatureLabel)}</div></div>`);
  }
  const footHtml = footCols.length
    ? `<div class="foot" style="grid-template-columns:repeat(${footCols.length},1fr);">${footCols.join('')}</div>`
    : '';

  const wordsBlock = cfgP.showWords !== false
    ? `<div><div class="lbl">Amount in Words</div><div class="val">${escapeHtml(amountInWords(totalAmount))}</div></div>`
    : '<div></div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${labels.docWord} ${sale.sale_number || ''}</title>
  <style>
    :root { --accent: ${accent}; }
    @page { size: ${ps.cssSize}; margin: ${isA5 ? '8mm' : '14mm'}; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    body {
      font-family: ${fontFamily};
      font-size: ${baseFs};
      color: #111;
      line-height: 1.4;
      width: ${ps.width};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
    .page { width: 100%; }

    .doc { border: ${showBorder ? '1px solid var(--accent)' : 'none'}; }

    /* ── Free-hand header band ── */
    .head-band {
      position: relative;
      height: ${bandHeight}mm;
      border-bottom: 1px solid var(--accent);
    }
    .hblk { position: absolute; }
    .logo { max-width: 100%; max-height: ${bandHeight - 6}mm; object-fit: contain; }
    .store-name { font-size: ${titleFs}; font-weight: 800; letter-spacing: 0.4px; line-height: 1.15; color: var(--accent); }
    .store-meta { font-size: ${storeMetaFs}; margin-top: 1.5mm; line-height: 1.45; }
    .doc-title { font-size: ${metaTitleFs}; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); }
    .doc-meta { font-size: ${metaFs}; margin-top: 2mm; line-height: 1.6; }
    .doc-meta .lbl { display: inline-block; text-align: left; }
    .doc-meta .val { font-weight: 700; }
    .doc-meta div { display: flex; justify-content: space-between; gap: 4mm; }

    /* ── Party (Bill To) ── */
    .party { padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'}; border-bottom: 1px solid var(--accent); }
    .party-title { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 1mm; }
    .party-name { font-size: ${partyNameFs}; font-weight: 700; }

    /* ── Items table ── */
    .items { width: 100%; border-collapse: collapse; }
    .items th, .items td { padding: ${isA5 ? '1.8mm 2mm' : '2.4mm 2.5mm'}; border-right: 1px solid var(--accent); vertical-align: top; }
    .items th:last-child, .items td:last-child { border-right: none; }
    .items thead th {
      font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
      border-bottom: 1px solid var(--accent); background: #f2f2f2; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .items tbody td { border-bottom: 1px dotted var(--accent); }
    .items tbody tr:last-child td { border-bottom: 1px solid var(--accent); }
    .items .c { text-align: center; }
    .items .r { text-align: right; }
    .items td.nm { font-weight: 600; }

    /* ── Summary band ── */
    .summary { display: grid; grid-template-columns: 1fr ${isA5 ? '60mm' : '80mm'}; border-top: 1px solid var(--accent); }
    .summary .words { padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'}; border-right: 1px solid var(--accent); display: flex; flex-direction: column; justify-content: space-between; }
    .words .lbl { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; }
    .words .val { margin-top: 1.5mm; font-size: ${isA5 ? pt(9) : pt(10.5)}; font-style: italic; }
    .words .notes { margin-top: 3mm; font-size: ${isA5 ? pt(8) : pt(9)}; }
    .words .notes .lbl { font-style: normal; }

    .summary .totals { padding: 0; }
    .totals-table { width: 100%; border-collapse: collapse; }
    .totals-table td { padding: ${isA5 ? '1.6mm 3mm' : '2mm 4mm'}; border-bottom: 1px dotted var(--accent); font-size: ${isA5 ? pt(9) : pt(10.5)}; }
    .totals-table td.r { text-align: right; font-variant-numeric: tabular-nums; }
    .totals-table tr.grand td {
      font-weight: 800; font-size: ${grandFs}; color: var(--accent);
      border-top: 1px solid var(--accent); border-bottom: 1px solid var(--accent);
      padding-top: ${isA5 ? '2.4mm' : '3mm'}; padding-bottom: ${isA5 ? '2.4mm' : '3mm'};
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .totals-table tr:last-child td { border-bottom: none; }

    /* ── Footer / signature ── */
    .foot { display: grid; border-top: 1px solid var(--accent); font-size: ${isA5 ? pt(8) : pt(9)}; }
    .foot .col { padding: ${isA5 ? '4mm' : '6mm'}; }
    .foot .col + .col { border-left: 1px solid var(--accent); text-align: right; }
    .foot .lbl { text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
    .foot .sig-line { margin-top: ${isA5 ? '12mm' : '16mm'}; border-top: 1px solid var(--accent); padding-top: 1mm; font-size: ${isA5 ? pt(7.5) : pt(8.5)}; }
    .terms { font-size: ${isA5 ? pt(7.5) : pt(8.5)}; line-height: 1.5; }
    .terms .lbl { display: block; margin-bottom: 1mm; }

    .thanks {
      text-align: center; padding: ${isA5 ? '2mm' : '3mm'}; font-size: ${isA5 ? pt(8) : pt(9)};
      letter-spacing: 1.5px; text-transform: uppercase; border-top: 1px solid var(--accent); font-weight: 700;
    }
  </style>
</head>
<body>
<div class="page">
  <div class="doc">

    <div class="head-band">
      ${logoBlock}
      ${storeBlock}
      ${metaBlock}
    </div>

    ${customerBlock}

    <table class="items">
      <colgroup>${colGroupHtml}</colgroup>
      <thead><tr>${theadHtml}</tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="summary">
      <div class="words">
        ${wordsBlock}
        ${sale.notes ? `<div class="notes"><span class="lbl">Notes:</span> ${escapeHtml(sale.notes)}</div>` : ''}
      </div>
      <div class="totals">
        <table class="totals-table">
          <tbody>
            <tr><td>Subtotal</td><td class="r">${money(subtotal)}</td></tr>
            ${totalItemDiscount > 0 ? `<tr><td>Item Discount</td><td class="r">− ${money(totalItemDiscount)}</td></tr>` : ''}
            ${gstSlabRows}
            ${totalBillDiscount > 0 ? `<tr><td>Bill Discount</td><td class="r">− ${money(totalBillDiscount)}</td></tr>` : ''}
            <tr class="grand"><td>Grand Total</td><td class="r">${money(totalAmount)}</td></tr>
            ${cashAmt > 0 ? `<tr><td>Cash</td><td class="r">${money(cashAmt)}</td></tr>` : ''}
            ${upiAmt > 0 ? `<tr><td>UPI</td><td class="r">${money(upiAmt)}</td></tr>` : ''}
            ${tenderedAmt > 0 ? `<tr><td>Cash Tendered</td><td class="r">${money(tenderedAmt)}</td></tr>` : ''}
            ${changeAmt > 0 ? `<tr><td>Change / Return</td><td class="r">${money(changeAmt)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>

    ${footHtml}

    <div class="thanks">${escapeHtml(thanksText)}</div>

  </div>
</div>
<script>
(function () {
  var b = document.body, fe = window.frameElement;
  function fit() {
    if (!fe) return;
    b.style.transformOrigin = 'top left';
    b.style.transform = 'none';
    var avail = fe.clientWidth || fe.offsetWidth || b.scrollWidth;
    var bw = b.scrollWidth || 1;
    var s = bw > avail ? avail / bw : 1;
    if (s < 1) b.style.transform = 'scale(' + s + ')';
    fe.style.height = Math.min(Math.ceil(b.scrollHeight * s) + 6, 620) + 'px';
  }
  addEventListener('load', function () { fit(); setTimeout(fit, 0); setTimeout(fit, 60); });
  addEventListener('resize', fit);
  addEventListener('beforeprint', function () { b.style.transform = 'none'; });
  addEventListener('afterprint', fit);
})();
</script>
</body>
</html>`;
}

export function printSaleReceipt(opts) {
  const html = buildSaleReceiptHtml(opts);
  const win = window.open('', '_blank', 'width=420,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
