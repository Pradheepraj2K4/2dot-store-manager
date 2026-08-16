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
import { mergeReceiptConfig, getInvoiceLabels } from './receiptConfig';

// Builds a UPI payment QR code as a data URL for the given VPA (UPI id).
// Returns null when no valid UPI id is supplied. Fully synchronous so it can
// be embedded directly in the receipt HTML string.
export function buildUpiQrDataUrl(upiId, { payeeName = '', amount = 0 } = {}) {
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
  return buildPaper({ sale, store, logoDataUrl, ps, format, labels, docType, cfg });
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
  const totalFreight      = parseFloat(sale.freight_charge) || 0;
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
        ${totalFreight > 0 ? `<div class="trow"><span class="tl">(+) Freight</span><span class="tr">${num(totalFreight, 2)}</span></div>` : ''}
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
function buildPaper({ sale, store, logoDataUrl, ps, format, labels, docType = 'sale', cfg }) {
  const isA5 = format === 'a5';
  const cfgP = cfg.paper;
  const il = getInvoiceLabels(cfg, 'sale');
  const isEstimate = docType === 'estimation';
  const items = Array.isArray(sale.items) ? sale.items : [];

  const totalItemDiscount = parseFloat(sale.total_discount) || 0;
  const totalBillDiscount = parseFloat(sale.bill_discount) || 0;
  const totalDiscount     = totalItemDiscount + totalBillDiscount;
  const totalFreight      = parseFloat(sale.freight_charge) || 0;
  const totalAmount       = parseFloat(sale.total_amount) || 0;
  const cashAmt           = parseFloat(sale.cash_amount) || 0;
  const upiAmt            = parseFloat(sale.upi_amount) || 0;
  const tenderedAmt       = parseFloat(sale.tendered_amount) || 0;
  const changeAmt         = Math.max(0, tenderedAmt - cashAmt);
  const totalQty          = items.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);

  // Per-slab taxable base + GST amount for the tax summary strip.
  const slabs = {};
  items.forEach((l) => {
    const rate = parseFloat(l.rate) || 0;
    const qty  = parseFloat(l.quantity) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    const gstP = parseFloat(l.gst_percent) || 0;
    const base = rate * qty * (1 - disc / 100);
    if (!slabs[gstP]) slabs[gstP] = { taxable: 0, gst: 0 };
    slabs[gstP].taxable += base;
    slabs[gstP].gst     += parseFloat(l.gst_amount) || 0;
  });
  const taxableTotal = Object.values(slabs).reduce((s, v) => s + v.taxable, 0);
  const cgstTotal    = Object.values(slabs).reduce((s, v) => s + v.gst / 2, 0);
  const sgstTotal    = cgstTotal;

  const taxSummaryRows = Object.entries(slabs)
    .filter(([pct]) => parseFloat(pct) > 0)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([pct, v]) => {
      const half = parseFloat(pct) / 2;
      const hAmt = Math.round(v.gst / 2 * 100) / 100;
      const halfTxt = num(half, half % 1 === 0 ? 0 : 1);
      return `<tr>
        <td class="c">${num(parseFloat(pct), 0)}</td>
        <td class="r">${num(v.taxable)}</td>
        <td class="c">${halfTxt}</td>
        <td class="r">${num(hAmt)}</td>
        <td class="c">${halfTxt}</td>
        <td class="r">${num(hAmt)}</td>
      </tr>`;
    }).join('');

  // ── Style tokens ──
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(cfgP.accentColor || '') ? cfgP.accentColor : '#000000';
  const fontFamily = cfgP.fontFamily || "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const F = Math.min(1.3, Math.max(0.8, parseFloat(cfgP.fontScale) || 1));
  const pt = (v) => `${+(v * F).toFixed(2)}pt`;

  const baseFs   = isA5 ? pt(9)   : pt(10.5);
  const titleFs  = isA5 ? pt(15)  : pt(20);
  const headFs   = isA5 ? pt(8.5) : pt(9.5);
  const grandFs  = isA5 ? pt(12)  : pt(14);

  const paperTitle = cfgP.titleText && cfgP.titleText.trim()
    ? cfgP.titleText.trim()
    : (isEstimate ? (labels.title || 'Estimate') : (il.title || labels.title || 'Tax Invoice'));
  const numberLabel = isEstimate ? (labels.numberLabelPaper || 'Estimate No.') : (il.numberLabel || 'Invoice No.');
  const dateLabel = isEstimate ? (labels.dateLabelPaper || 'Date') : (il.dateLabel || 'Date');
  const signatureLabel = cfgP.signatureLabel && cfgP.signatureLabel.trim() ? cfgP.signatureLabel.trim() : 'Authorised Signatory';

  const logoHtml = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="Logo"/>`
    : '';

  const contactBits = [
    store.phone ? `Cell: ${escapeHtml(store.phone)}` : '',
    store.email ? `email: ${escapeHtml(store.email)}` : '',
  ].filter(Boolean).join('<br>');

  const termsSource = (cfgP.termsText && String(cfgP.termsText).trim())
    ? String(cfgP.termsText)
    : (store.terms_conditions && String(store.terms_conditions).trim() ? String(store.terms_conditions) : '');
  const termsLines = termsSource.trim()
    ? termsSource.split('\n').map((t) => t.trim()).filter(Boolean)
    : ['Goods once sold cannot be taken back.', 'Subject to local jurisdiction.', 'Our responsibility ceases on delivery of goods.'];
  const termsHtml = termsLines.map((t) => `<li>${escapeHtml(t)}</li>`).join('');

  // Optional-column visibility (paper.columns). Item, Qty and Amount are always
  // shown; every other column is toggled from the A4/A5 design settings.
  const cols = cfgP.columns || {};
  const colOn = (k) => cols[k] !== false;
  const columnDefs = [
    { key: 'sno', cls: 'col-no', th: il.colSno, cell: (l, i) => `<td class="c">${i + 1}</td>` },
    { key: 'item', cls: 'col-name', th: il.colItem, always: true, cell: (l) => `<td class="nm">${escapeHtml(l.item_name || '')}</td>` },
    { key: 'hsn', cls: 'col-hsn', th: il.colHsn, cell: (l) => `<td class="c">${escapeHtml(l.hsn_code || l.hsn || '')}</td>` },
    { key: 'unit', cls: 'col-unit', th: il.colUnit, cell: (l) => `<td class="c">${escapeHtml(l.unit || '')}</td>` },
    { key: 'mrp', cls: 'col-mrp', th: il.colMrp, cell: (l) => { const mrp = parseFloat(l.mrp) || 0; return `<td class="r">${mrp ? num(mrp, mrp % 1 === 0 ? 0 : 2) : '—'}</td>`; } },
    { key: 'qty', cls: 'col-qty', th: il.colQty, always: true, cell: (l) => { const q = parseFloat(l.quantity) || 0; return `<td class="r">${num(q, q % 1 === 0 ? 0 : 2)}</td>`; } },
    { key: 'rate', cls: 'col-rate', th: il.colRate, cell: (l) => { const rate = parseFloat(l.rate) || 0; return `<td class="r">${num(rate, rate % 1 === 0 ? 0 : 2)}</td>`; } },
    { key: 'gst', cls: 'col-gst', th: il.colGst, cell: (l) => { const gst = parseFloat(l.gst_percent) || 0; return `<td class="c">${gst ? num(gst, 0) : '0'}</td>`; } },
    { key: 'discount', cls: 'col-dis', th: il.colDiscount, cell: (l) => { const disc = parseFloat(l.discount_percent) || 0; return `<td class="c">${disc ? num(disc, 0) : '0'}</td>`; } },
    { key: 'amount', cls: 'col-amt', th: il.colAmount, always: true, cell: (l) => `<td class="r">${num(l.amount)}</td>` },
  ];
  const activeCols = columnDefs.filter((c) => c.always || colOn(c.key));
  const colgroupHtml = activeCols.map((c) => `<col class="${c.cls}"/>`).join('');
  const theadHtml = activeCols.map((c) => `<th>${escapeHtml(c.th)}</th>`).join('');
  const itemsRows = items
    .map((l, i) => `<tr>${activeCols.map((c) => c.cell(l, i)).join('')}</tr>`)
    .join('');

  // Blank filler row keeps the items table at a fixed height regardless of the
  // number of lines, so short invoices keep the same tall ruled body as long ones.
  const fillerRow = `<tr class="filler">${activeCols
    .map((c) => (c.key === 'item' ? '<td class="nm remarks">Remarks:</td>' : '<td></td>'))
    .join('')}</tr>`;

  const itemsTableHeight = isA5 ? '58mm' : '120mm';

  const buyerName = sale.customer_name && sale.customer_name.trim() ? sale.customer_name.trim() : 'Walk-in Customer';
  const buyerMobile = sale.customer_mobile && sale.customer_mobile.trim() ? sale.customer_mobile.trim() : '';

  const paySplit = [
    cashAmt > 0 ? `Cash: ${num(cashAmt)}` : '',
    upiAmt > 0 ? `UPI: ${num(upiAmt)}` : '',
    changeAmt > 0 ? `Change: ${num(changeAmt)}` : '',
  ].filter(Boolean).join('<br>');

  // UPI payment QR for the invoice footer (encodes store VPA + bill total).
  const upiQrDataUrl = buildUpiQrDataUrl(store?.upi_id, {
    payeeName: store.store_name || '',
    amount: totalAmount,
  });

  // Section-level A4/A5 design toggles.
  const showBorder = cfgP.showBorder !== false;
  const showWords = cfgP.showWords !== false;
  const showTerms = cfgP.showTerms !== false;
  const showSignature = cfgP.showSignature !== false;
  const thanksText = (cfgP.thanksText && String(cfgP.thanksText).trim()) ? String(cfgP.thanksText).trim() : '';

  const footCols = [];
  if (showTerms) {
    footCols.push(`<div class="col terms"><span class="lbl">Terms &amp; Condition</span><ol>${termsHtml}</ol></div>`);
  }
  if (showSignature) {
    footCols.push(`<div class="col sig"><span class="lbl">Receiver Signature</span><div class="sig-space"></div></div>`);
    footCols.push(`<div class="col sig"><span class="lbl">For ${escapeHtml(store.store_name || 'Store')}</span><div class="sig-space">${escapeHtml(signatureLabel)}</div></div>`);
  }
  const footGrid = (showTerms && showSignature) ? '1.4fr 1fr 1fr' : (showTerms ? '1fr' : '1fr 1fr');
  const footHtml = footCols.length
    ? `<div class="foot" style="grid-template-columns: ${footGrid};">${footCols.join('')}</div>`
    : '';

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
      color: #000;
      line-height: 1.4;
      width: ${ps.width};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
    .page { width: 100%; }

    .doc { border: ${showBorder ? '1.4px solid var(--accent)' : 'none'}; }

    .head {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      border-bottom: 1.4px solid var(--accent);
    }
    .head .left { padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'}; display: flex; align-items: center; gap: 4mm; }
    .head .left > div { flex: 1; min-width: 0; }
    .head .right { border-left: 1.4px solid var(--accent); display: flex; flex-direction: column; }
    .logo { max-height: ${isA5 ? '14mm' : '18mm'}; max-width: ${isA5 ? '24mm' : '32mm'}; object-fit: contain; }
    .store-name { font-size: ${titleFs}; font-weight: 800; letter-spacing: 0.4px; line-height: 1.1; color: var(--accent); }
    .store-meta { font-size: ${isA5 ? pt(8) : pt(9)}; margin-top: 1mm; line-height: 1.4; }

    .doc-title {
      font-size: ${isA5 ? pt(11) : pt(13)};
      font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-align: center;
      padding: ${isA5 ? '2mm' : '3mm'};
      border-bottom: 1.4px solid var(--accent);
      color: var(--accent);
    }
    .doc-meta { font-size: ${isA5 ? pt(8.5) : pt(9.5)}; line-height: 1.5; padding: ${isA5 ? '2mm 3mm' : '3mm 4mm'}; flex: 1; }
    .doc-meta div { display: flex; justify-content: space-between; gap: 3mm; padding: 0.4mm 0; }
    .doc-meta .lbl { font-weight: 700; }
    .doc-meta .val { font-weight: 700; text-align: right; }

    .gst-row {
      border-bottom: 1.4px solid var(--accent);
      font-size: ${headFs}; font-weight: 700;
    }
    .gst-row > div { padding: ${isA5 ? '1.5mm 4mm' : '2mm 6mm'}; }

    .parties { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.4px solid var(--accent); }
    .party { padding: ${isA5 ? '2.5mm 4mm' : '3mm 6mm'}; }
    .party + .party { border-left: 1.4px solid var(--accent); }
    .party-title { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 1mm; text-align: center; }
    .party-name { font-size: ${isA5 ? pt(10) : pt(11.5)}; font-weight: 700; }
    .party-meta { font-size: ${isA5 ? pt(8) : pt(9)}; line-height: 1.4; margin-top: 0.5mm; }

    .items { width: 100%; border-collapse: collapse; table-layout: fixed; height: ${itemsTableHeight}; }
    .items th, .items td {
      padding: ${isA5 ? '1.2mm 1.6mm' : '1.6mm 2mm'};
      border-right: 1px solid var(--accent); vertical-align: top;
      font-size: ${isA5 ? pt(8) : pt(9)}; word-break: break-word;
    }
    .items th:last-child, .items td:last-child { border-right: none; }
    .items thead th {
      font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
      border-bottom: 1.4px solid var(--accent); text-align: center;
      background: #f2f2f2; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .items tbody td { border-bottom: none; }
    .items .c { text-align: center; white-space: nowrap; }
    .items .r { text-align: right; white-space: nowrap; }
    .items td.nm { font-weight: 600; text-align: left; }
    .items .filler td { height: 100%; }
    .items .filler .remarks { vertical-align: bottom; font-weight: 700; }

    .items col.col-no   { width: ${isA5 ? '7mm'  : '9mm'}; }
    .items col.col-name { width: auto; }
    .items col.col-hsn  { width: ${isA5 ? '14mm' : '18mm'}; }
    .items col.col-unit { width: ${isA5 ? '12mm' : '15mm'}; }
    .items col.col-mrp  { width: ${isA5 ? '15mm' : '19mm'}; }
    .items col.col-qty  { width: ${isA5 ? '11mm' : '13mm'}; }
    .items col.col-rate { width: ${isA5 ? '14mm' : '18mm'}; }
    .items col.col-gst  { width: ${isA5 ? '10mm' : '12mm'}; }
    .items col.col-dis  { width: ${isA5 ? '10mm' : '12mm'}; }
    .items col.col-amt  { width: ${isA5 ? '16mm' : '22mm'}; }

    .summary { display: grid; grid-template-columns: 1fr ${isA5 ? '58mm' : '76mm'}; border-top: 1.4px solid var(--accent); }
    .summary .sum-left { border-right: 1.4px solid var(--accent); display: flex; flex-direction: column; }

    .tax-summary { width: 100%; border-collapse: collapse; }
    .tax-summary th, .tax-summary td {
      border: 1px solid var(--accent); padding: ${isA5 ? '1mm 1.5mm' : '1.4mm 2mm'};
      font-size: ${isA5 ? pt(7.5) : pt(8.5)};
    }
    .tax-summary th { font-weight: 700; text-transform: uppercase; text-align: center; }
    .tax-summary .c { text-align: center; }
    .tax-summary .r { text-align: right; }
    .tax-summary td:first-child, .tax-summary th:first-child { border-left: none; }
    .tax-summary td:last-child, .tax-summary th:last-child { border-right: none; }
    .tax-summary tr:first-child th { border-top: none; }

    .pay { padding: ${isA5 ? '2.5mm 4mm' : '3mm 6mm'}; font-size: ${isA5 ? pt(8) : pt(9)}; line-height: 1.5; flex: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 3mm; }
    .pay .pay-info { flex: 1; min-width: 0; }
    .pay .pay-qr { flex-shrink: 0; text-align: center; }
    .pay .pay-qr img { width: ${isA5 ? '18mm' : '22mm'}; height: ${isA5 ? '18mm' : '22mm'}; display: block; }
    .pay .pay-qr span { display: block; margin-top: 0.5mm; font-size: ${isA5 ? pt(6.5) : pt(7)}; font-weight: 600; }
    .pay .lbl { font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; text-decoration: underline; margin-bottom: 1mm; display: block; }

    .totals-table { width: 100%; border-collapse: collapse; height: 100%; }
    .totals-table td { padding: ${isA5 ? '0.6mm 3mm' : '0.8mm 4mm'}; font-size: ${isA5 ? pt(9) : pt(10)}; }
    .totals-table td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    .totals-table td.k { text-align: left; }
    .totals-table tr.grand td {
      font-weight: 800; font-size: ${grandFs}; color: var(--accent);
      border-top: 1.4px solid var(--accent);
      padding-top: ${isA5 ? '2mm' : '2.6mm'}; padding-bottom: ${isA5 ? '2mm' : '2.6mm'};
      text-transform: uppercase;
    }

    .words {
      padding: ${isA5 ? '2mm 4mm' : '2.5mm 6mm'};
      border-top: 1.4px solid var(--accent);
      font-size: ${isA5 ? pt(8.5) : pt(9.5)};
    }
    .words .lbl { font-weight: 700; }

    .foot {
      display: grid; grid-template-columns: 1.4fr 1fr 1fr;
      border-top: 1.4px solid var(--accent);
      font-size: ${isA5 ? pt(8) : pt(9)};
    }
    .foot .col { padding: ${isA5 ? '3mm' : '4mm'}; }
    .foot .col + .col { border-left: 1.4px solid var(--accent); }
    .foot .sig { text-align: center; display: flex; flex-direction: column; justify-content: space-between; }
    .foot .lbl { text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-bottom: 1mm; display: block; }
    .foot .sig-space { margin-top: ${isA5 ? '10mm' : '14mm'}; }
    .terms { line-height: 1.5; }
    .terms ol { margin: 0.5mm 0 0 4mm; padding: 0; }

    .system-tag {
      text-align: center; padding: ${isA5 ? '1.5mm' : '2mm'};
      font-size: ${isA5 ? pt(7) : pt(8)}; letter-spacing: 1px; text-transform: uppercase;
      border-top: 1.4px solid var(--accent); font-weight: 700;
    }
    .thanks {
      text-align: center; padding: ${isA5 ? '2mm' : '2.5mm'};
      font-size: ${isA5 ? pt(9) : pt(10)}; font-weight: 700; letter-spacing: 0.4px;
      border-top: 1.4px solid var(--accent); color: var(--accent);
    }
  </style>
</head>
<body>
<div class="page">
  <div class="doc">

    <div class="head">
      <div class="left">
        ${logoHtml}
        <div>
          <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
          <div class="store-meta">
            ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
            ${store.place ? `${escapeHtml(store.place)}<br>` : ''}
            ${contactBits}
          </div>
        </div>
      </div>
      <div class="right">
        <div class="doc-title">${escapeHtml(paperTitle)}</div>
        <div class="doc-meta">
          <div><span class="lbl">${escapeHtml(numberLabel)}</span><span class="val">${escapeHtml(sale.sale_number || '—')}</span></div>
          <div><span class="lbl">${escapeHtml(dateLabel)}</span><span class="val">${fmt(sale.date)}</span></div>
          ${sale.service_type ? `<div><span class="lbl">Dining</span><span class="val">${sale.service_type === 'ac' ? 'A/C' : 'Non-A/C'}</span></div>` : ''}
          ${sale.waiter_name && sale.waiter_name.trim() ? `<div><span class="lbl">Waiter</span><span class="val">${escapeHtml(sale.waiter_name.trim())}</span></div>` : ''}
        </div>
      </div>
    </div>

    <div class="gst-row">
      <div>GSTIN: ${escapeHtml(store.gst_tax_id || '—')}</div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-title">${escapeHtml(il.partyTitle)}</div>
        <div class="party-name">${escapeHtml(buyerName)}</div>
        ${buyerMobile ? `<div class="party-meta">Mobile: ${escapeHtml(buyerMobile)}</div>` : ''}
      </div>
      <div class="party">
        <div class="party-title">Shipping Address</div>
        <div class="party-name">${escapeHtml(buyerName)}</div>
        ${buyerMobile ? `<div class="party-meta">Mobile: ${escapeHtml(buyerMobile)}</div>` : ''}
      </div>
    </div>

    <table class="items">
      <colgroup>${colgroupHtml}</colgroup>
      <thead>
        <tr>${theadHtml}</tr>
      </thead>
      <tbody>
        ${itemsRows}
        ${fillerRow}
      </tbody>
    </table>

    <div class="summary">
      <div class="sum-left">
        <table class="tax-summary">
          <thead>
            <tr>
              <th>GST%</th><th>Amount</th><th>CGST%</th><th>CGST</th><th>SGST%</th><th>SGST</th>
            </tr>
          </thead>
          <tbody>
            ${taxSummaryRows || '<tr><td class="c">—</td><td class="r">0.00</td><td class="c">—</td><td class="r">0.00</td><td class="c">—</td><td class="r">0.00</td></tr>'}
          </tbody>
        </table>
        <div class="pay">
          <div class="pay-info">
            <span class="lbl">For Making Payment</span>
            ${store.upi_id ? `Gpay / UPI: ${escapeHtml(store.upi_id)}<br>` : ''}
            ${paySplit ? `${paySplit}<br>` : ''}
            ${contactBits}
          </div>
          ${upiQrDataUrl ? `<div class="pay-qr"><img src="${upiQrDataUrl}" alt="UPI QR"/><span>Scan to Pay</span></div>` : ''}
        </div>
      </div>
      <div class="totals">
        <table class="totals-table">
          <tbody>
            <tr><td class="k">${escapeHtml(il.totalAmount)}</td><td class="r">${num(taxableTotal)}</td></tr>
            <tr><td class="k">${escapeHtml(il.discountLabel)}</td><td class="r">${num(totalDiscount)}</td></tr>
            <tr><td class="k">Add : CGST</td><td class="r">${num(cgstTotal)}</td></tr>
            <tr><td class="k">Add : SGST</td><td class="r">${num(sgstTotal)}</td></tr>
            <tr><td class="k">Add : IGST</td><td class="r">${num(0)}</td></tr>
            <tr><td class="k">${escapeHtml(il.freightLabel)}</td><td class="r">${num(totalFreight)}</td></tr>
            <tr><td class="k">${escapeHtml(il.netQtyLabel)}</td><td class="r">${num(totalQty, totalQty % 1 === 0 ? 0 : 2)}</td></tr>
            <tr class="grand"><td class="k">${escapeHtml(il.grandTotalLabel)}</td><td class="r">${num(totalAmount)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    ${showWords ? `<div class="words">
      <span class="lbl">${escapeHtml(il.wordsLabel)}</span> ${escapeHtml(amountInWords(totalAmount))}
    </div>` : ''}

    ${footHtml}

    ${thanksText ? `<div class="thanks">${escapeHtml(thanksText)}</div>` : ''}
    <div class="system-tag">**** This is a system generated invoice ***</div>

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
