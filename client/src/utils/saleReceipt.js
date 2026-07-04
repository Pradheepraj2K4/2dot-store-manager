/**
 * Sale / Invoice Receipt printer
 *
 * Generates a print-ready HTML page for an item sale.
 * `format`: 'a5' | 'a4' | 'thermal'
 *
 *  - thermal : 80mm POS roll, monospaced, stacked line layout
 *  - a4 / a5 : standard monochrome tax invoice with two-column header,
 *              Bill-To block, ruled items table and totals panel
 */

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
}) {
  const ps = PAGE_SIZES[format] || PAGE_SIZES.thermal;
  const isThermal = format === 'thermal';
  const labels = DOC_LABELS[docType] || DOC_LABELS.sale;

  if (isThermal) return buildThermal({ sale, ledgerName, store, logoDataUrl, ps, labels, docType });
  return buildPaper({ sale, store, logoDataUrl, ps, format, labels });
}

// ───────────────────────────────────────────────────────────────────────────
// Thermal (80mm) — POS-style monospaced receipt
// ───────────────────────────────────────────────────────────────────────────
function buildThermal({ sale, ledgerName, store, logoDataUrl, ps, labels, docType }) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const totalQty          = items.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalItemDiscount = parseFloat(sale.total_discount) || 0;
  const totalBillDiscount = parseFloat(sale.bill_discount) || 0;
  const totalAmount       = parseFloat(sale.total_amount) || 0;
  const cashAmt           = parseFloat(sale.cash_amount) || 0;
  const upiAmt            = parseFloat(sale.upi_amount) || 0;

  // Gross before any discount = Σ(rate × qty). Reconciles as:
  //   grossBeforeDisc − (itemDiscount + billDiscount) = totalAmount
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

  // Payment mode derived from tender split.
  const payMode = (cashAmt > 0 && upiAmt > 0)
    ? 'CASH+UPI'
    : (upiAmt > 0 ? 'UPI' : 'Cash');

  const thermalTitle = docType === 'sale' ? 'Retail Invoice' : labels.title;

  // 3-column item table: Item | Qty | Amt
  const itemsRows = items.map((l) => {
    const qty = parseFloat(l.quantity) || 0;
    return `
      <div class="trow item">
        <span class="c-item">${escapeHtml(l.item_name || '')}</span>
        <span class="c-qty">${num(qty, qty % 1 === 0 ? 0 : 2)}</span>
        <span class="c-amt">${num(l.amount, 2)}</span>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${labels.docWord} ${sale.sale_number || ''}</title>
  <style>
    @page { size: ${ps.cssSize}; margin: 3mm 2mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body, body * { color: #000 !important; background: transparent !important; border-color: #000 !important; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      width: ${ps.width};
      filter: grayscale(100%);
      -webkit-filter: grayscale(100%);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
    .page { width: 100%; padding: 1mm 2mm; }

    .logo-wrap { text-align: center; margin-bottom: 1.5mm; }
    .logo-wrap img { max-height: 12mm; max-width: 100%; object-fit: contain; filter: grayscale(100%) contrast(1.15); }

    /* ── Centered store header ── */
    .header { text-align: center; }
    .store-name { font-size: 14pt; font-weight: 800; letter-spacing: 0.3px; }
    .store-meta { font-size: 8pt; margin-top: 0.6mm; line-height: 1.4; }

    /* ── Title ── */
    .title {
      text-align: center;
      font-weight: 800;
      font-size: 11pt;
      margin: 1.5mm 0 1mm;
    }

    /* ── Rules ── */
    .rule-dash  { border-top: 1px dashed #000; margin: 1mm 0; }
    .rule-solid { border-top: 1px solid #000;  margin: 0.8mm 0; }

    /* ── Meta block: left-aligned "Label : value" ── */
    .meta { font-size: 9pt; }
    .meta .line { padding: 0.15mm 0; }
    .meta .party { font-weight: 800; font-size: 9.5pt; padding: 0.4mm 0; }

    /* ── Table rows (items + totals share a 3-col grid) ── */
    .trow {
      display: flex;
      align-items: baseline;
      font-size: 9pt;
      padding: 0.3mm 0;
    }
    .c-item, .tl { flex: 1; word-break: break-word; padding-right: 1.5mm; }
    .c-qty { width: 9mm; text-align: center; white-space: nowrap; }
    .c-amt, .tr { width: 20mm; text-align: right; white-space: nowrap; }

    .items-head { font-weight: 800; }
    .trow.item { }

    /* Totals section */
    .trow.sub { font-weight: 700; }
    .trow.disc .tl,
    .trow.disc .tr { font-weight: 600; }
    .gst .tl, .gst .tr { font-size: 8pt; }

    .grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 900;
      font-size: 12.5pt;
      padding: 1.2mm 0;
      margin: 0.8mm 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .grand .g-amt { white-space: nowrap; }

    .pay { font-size: 9pt; }
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

  <!-- Header -->
  <div class="header">
    <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
    <div class="store-meta">
      ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
      ${store.place ? `${escapeHtml(store.place)}<br>` : ''}
      ${store.phone ? `PHONE : ${escapeHtml(store.phone)}` : ''}${store.phone && store.email ? '<br>' : ''}${store.email ? escapeHtml(store.email) : ''}
      ${store.gst_tax_id ? `<br>GSTIN : ${escapeHtml(store.gst_tax_id)}` : ''}
    </div>
  </div>

  <div class="title">${escapeHtml(thermalTitle)}</div>

  <div class="rule-dash"></div>

  <!-- Meta -->
  <div class="meta">
    <div class="line">Date : ${fmtDMY(sale.date)}${sale.time ? ', ' + fmt12(sale.time) : ''}</div>
    ${sale.customer_name && sale.customer_name.trim() ? `<div class="party">${escapeHtml(sale.customer_name.trim())}</div>` : ''}
    <div class="line">${escapeHtml(labels.numberLabelThermal)} : ${escapeHtml(sale.sale_number || '—')}</div>
    <div class="line">Payment Mode : ${payMode}</div>
    ${sale.service_type ? `<div class="line">Dining : ${sale.service_type === 'ac' ? 'A/C' : 'Non-A/C'}</div>` : ''}
    ${sale.waiter_name && sale.waiter_name.trim() ? `<div class="line">Waiter : ${escapeHtml(sale.waiter_name.trim())}</div>` : ''}
  </div>

  <div class="rule-dash"></div>

  <!-- Items -->
  <div class="items-head trow">
    <span class="c-item">Item</span>
    <span class="c-qty">Qty</span>
    <span class="c-amt">Amt</span>
  </div>
  <div class="rule-solid"></div>
  ${itemsRows}
  <div class="rule-solid"></div>

  <!-- Sub total -->
  <div class="trow sub">
    <span class="c-item">Sub Total</span>
    <span class="c-qty">${num(totalQty, totalQty % 1 === 0 ? 0 : 2)}</span>
    <span class="c-amt">${num(grossBeforeDisc, 2)}</span>
  </div>

  <!-- Totals -->
  <div class="totals">
    ${totalDiscount > 0 ? `<div class="trow disc"><span class="tl">(-) Discount</span><span class="tr">${num(totalDiscount, 2)}</span></div>` : ''}
    <div class="gst">${gstSlabRows}</div>
  </div>

  <div class="grand">
    <span>TOTAL</span>
    <span class="g-amt">Rs ${num(totalAmount, 2)}</span>
  </div>

  <!-- Payment -->
  <div class="pay">
    ${cashAmt > 0 ? `<div class="trow"><span class="tl">Cash :</span><span class="tr">Rs ${num(cashAmt, 2)}</span></div>` : ''}
    ${upiAmt > 0 ? `<div class="trow"><span class="tl">UPI :</span><span class="tr">Rs ${num(upiAmt, 2)}</span></div>` : ''}
    ${cashAmt > 0 ? `<div class="trow"><span class="tl">Cash tendered :</span><span class="tr">Rs ${num(cashAmt, 2)}</span></div>` : ''}
  </div>

  <div class="words">${escapeHtml(amountInWords(totalAmount))}</div>

  ${sale.notes ? `<div class="notes"><span class="lbl">Notes:</span> ${escapeHtml(sale.notes)}</div>` : ''}

  <div class="footer">
    <div class="eoe">E &amp; O E</div>
    <div class="thanks">${escapeHtml(labels.thanksThermal)}</div>
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

// ───────────────────────────────────────────────────────────────────────────
// A4 / A5 — standard monochrome tax invoice
// ───────────────────────────────────────────────────────────────────────────
function buildPaper({ sale, store, logoDataUrl, ps, format, labels }) {
  const isA5 = format === 'a5';
  const items = Array.isArray(sale.items) ? sale.items : [];

  const totalItemDiscount = parseFloat(sale.total_discount) || 0;
  const totalBillDiscount = parseFloat(sale.bill_discount) || 0;
  const totalAmount       = parseFloat(sale.total_amount) || 0;
  const cashAmt           = parseFloat(sale.cash_amount) || 0;
  const upiAmt            = parseFloat(sale.upi_amount) || 0;

  // Subtotal before tax = sum of (rate * qty * (1 - disc/100)) per line
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

  const logoHtml = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="Logo"/>`
    : '';

  const customerBlock = sale.customer_name && sale.customer_name.trim()
    ? `<div class="party">
         <div class="party-title">Bill To</div>
         <div class="party-name">${escapeHtml(sale.customer_name.trim())}</div>
       </div>`
    : '';

  const itemsRows = items.map((l, i) => {
    const rate = parseFloat(l.rate) || 0;
    const qty  = parseFloat(l.quantity) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    const gst  = parseFloat(l.gst_percent) || 0;
    const taxable = rate * qty * (1 - disc / 100);
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${escapeHtml(l.item_name || '')}</td>
        <td class="c">${escapeHtml(l.unit || '')}</td>
        <td class="r">${num(qty, qty % 1 === 0 ? 0 : 2)}</td>
        <td class="r">${money(rate)}</td>
        <td class="r">${disc ? num(disc, 0) + '%' : '—'}</td>
        <td class="r">${gst ? num(gst, 0) + '%' : '—'}</td>
        <td class="r">${money(taxable)}</td>
        <td class="r">${money(l.amount)}</td>
      </tr>
    `;
  }).join('');

  // Font sizes scaled for paper
  const baseFs   = isA5 ? '9pt'  : '10.5pt';
  const titleFs  = isA5 ? '15pt' : '20pt';
  const headFs   = isA5 ? '8.5pt' : '9.5pt';
  const grandFs  = isA5 ? '12pt' : '14pt';
  const padPage  = isA5 ? '0' : '0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${labels.docWord} ${sale.sale_number || ''}</title>
  <style>
    @page { size: ${ps.cssSize}; margin: ${isA5 ? '8mm' : '14mm'}; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    body, body * { color: #000 !important; background: transparent !important; border-color: #000 !important; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: ${baseFs};
      line-height: 1.4;
      width: ${ps.width};
    }
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
    .page { width: 100%; padding: ${padPage}; }

    /* ── Outer document frame ── */
    .doc { border: 1px solid #000; }

    /* ── Header band ── */
    .head {
      display: grid;
      grid-template-columns: 6fr 4fr;
      border-bottom: 1px solid #000;
    }
    .head .left, .head .right {
      padding: ${isA5 ? '4mm' : '6mm'};
    }
    .head .right {
      border-left: 1px solid #000;
      text-align: right;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .store-row { display: flex; align-items: center; gap: 4mm; }
    .logo { max-height: ${isA5 ? '14mm' : '18mm'}; max-width: ${isA5 ? '24mm' : '32mm'}; object-fit: contain; filter: grayscale(100%); }
    .store-name { font-size: ${titleFs}; font-weight: 800; letter-spacing: 0.4px; line-height: 1.15; }
    .store-meta { font-size: ${isA5 ? '8pt' : '9pt'}; margin-top: 1.5mm; line-height: 1.45; }

    .doc-title {
      font-size: ${isA5 ? '11pt' : '13pt'};
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .doc-meta {
      font-size: ${isA5 ? '8.5pt' : '9.5pt'};
      margin-top: 2mm;
      line-height: 1.6;
    }
    .doc-meta .lbl { display: inline-block; min-width: ${isA5 ? '20mm' : '24mm'}; text-align: left; }
    .doc-meta .val { font-weight: 700; }
    .doc-meta div { display: flex; justify-content: space-between; gap: 4mm; }

    /* ── Party (Bill To) ── */
    .party {
      padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'};
      border-bottom: 1px solid #000;
    }
    .party-title { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 1mm; }
    .party-name { font-size: ${isA5 ? '10.5pt' : '12pt'}; font-weight: 700; }

    /* ── Items table ── */
    .items {
      width: 100%;
      border-collapse: collapse;
    }
    .items th, .items td {
      padding: ${isA5 ? '1.8mm 2mm' : '2.4mm 2.5mm'};
      border-right: 1px solid #000;
      vertical-align: top;
    }
    .items th:last-child, .items td:last-child { border-right: none; }
    .items thead th {
      font-size: ${headFs};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 1px solid #000;
      background: #f2f2f2;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .items tbody td { border-bottom: 1px dotted #000; }
    .items tbody tr:last-child td { border-bottom: 1px solid #000; }
    .items .c { text-align: center; }
    .items .r { text-align: right; }
    .items td:nth-child(2) { font-weight: 600; }

    /* Hand-build column widths — keeps tabular alignment tidy at A4/A5 */
    .items col.col-no    { width: ${isA5 ? '8mm'  : '10mm'}; }
    .items col.col-name  { width: auto; }
    .items col.col-unit  { width: ${isA5 ? '12mm' : '15mm'}; }
    .items col.col-qty   { width: ${isA5 ? '14mm' : '18mm'}; }
    .items col.col-rate  { width: ${isA5 ? '20mm' : '24mm'}; }
    .items col.col-disc  { width: ${isA5 ? '14mm' : '16mm'}; }
    .items col.col-gst   { width: ${isA5 ? '14mm' : '16mm'}; }
    .items col.col-tax   { width: ${isA5 ? '22mm' : '26mm'}; }
    .items col.col-amt   { width: ${isA5 ? '24mm' : '30mm'}; }

    /* ── Summary band: words on left, totals table on right ── */
    .summary {
      display: grid;
      grid-template-columns: 1fr ${isA5 ? '60mm' : '80mm'};
      border-top: 1px solid #000;
    }
    .summary .words {
      padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'};
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .words .lbl { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; }
    .words .val { margin-top: 1.5mm; font-size: ${isA5 ? '9pt' : '10.5pt'}; font-style: italic; }
    .words .notes { margin-top: 3mm; font-size: ${isA5 ? '8pt' : '9pt'}; }
    .words .notes .lbl { font-style: normal; }

    .summary .totals { padding: 0; }
    .totals-table { width: 100%; border-collapse: collapse; }
    .totals-table td {
      padding: ${isA5 ? '1.6mm 3mm' : '2mm 4mm'};
      border-bottom: 1px dotted #000;
      font-size: ${isA5 ? '9pt' : '10.5pt'};
    }
    .totals-table td.r { text-align: right; font-variant-numeric: tabular-nums; }
    .totals-table tr.grand td {
      font-weight: 800;
      font-size: ${grandFs};
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding-top: ${isA5 ? '2.4mm' : '3mm'};
      padding-bottom: ${isA5 ? '2.4mm' : '3mm'};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .totals-table tr:last-child td { border-bottom: none; }

    /* ── Footer / signature ── */
    .foot {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #000;
      font-size: ${isA5 ? '8pt' : '9pt'};
    }
    .foot .col {
      padding: ${isA5 ? '4mm' : '6mm'};
    }
    .foot .col + .col { border-left: 1px solid #000; text-align: right; }
    .foot .lbl { text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
    .foot .sig-line {
      margin-top: ${isA5 ? '12mm' : '16mm'};
      border-top: 1px solid #000;
      padding-top: 1mm;
      font-size: ${isA5 ? '7.5pt' : '8.5pt'};
    }
    .terms { font-size: ${isA5 ? '7.5pt' : '8.5pt'}; line-height: 1.5; }
    .terms .lbl { display: block; margin-bottom: 1mm; }

    .thanks {
      text-align: center;
      padding: ${isA5 ? '2mm' : '3mm'};
      font-size: ${isA5 ? '8pt' : '9pt'};
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border-top: 1px solid #000;
      font-weight: 700;
    }
  </style>
</head>
<body>
<div class="page">
  <div class="doc">

    <!-- Header -->
    <div class="head">
      <div class="left">
        <div class="store-row">
          ${logoHtml}
          <div>
            <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
            <div class="store-meta">
              ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
              ${store.place ? `${escapeHtml(store.place)}<br>` : ''}
              ${store.phone ? `Phone: ${escapeHtml(store.phone)}<br>` : ''}
              ${store.email ? `Email: ${escapeHtml(store.email)}<br>` : ''}
              ${store.gst_tax_id ? `GSTIN: ${escapeHtml(store.gst_tax_id)}` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="right">
        <div class="doc-title">${escapeHtml(labels.title)}</div>
        <div class="doc-meta">
          <div><span class="lbl">${escapeHtml(labels.numberLabelPaper)}</span><span class="val">${escapeHtml(sale.sale_number || '—')}</span></div>
          <div><span class="lbl">${escapeHtml(labels.dateLabelPaper)}</span><span class="val">${fmt(sale.date)}${sale.time ? ' · ' + escapeHtml(sale.time) : ''}</span></div>
          <div><span class="lbl">Items</span><span class="val">${items.length}</span></div>
          ${sale.service_type ? `<div><span class="lbl">Dining</span><span class="val">${sale.service_type === 'ac' ? 'A/C' : 'Non-A/C'}</span></div>` : ''}
          ${sale.waiter_name && sale.waiter_name.trim() ? `<div><span class="lbl">Waiter</span><span class="val">${escapeHtml(sale.waiter_name.trim())}</span></div>` : ''}
        </div>
      </div>
    </div>

    ${customerBlock}

    <!-- Items -->
    <table class="items">
      <colgroup>
        <col class="col-no"/>
        <col class="col-name"/>
        <col class="col-unit"/>
        <col class="col-qty"/>
        <col class="col-rate"/>
        <col class="col-disc"/>
        <col class="col-gst"/>
        <col class="col-tax"/>
        <col class="col-amt"/>
      </colgroup>
      <thead>
        <tr>
          <th class="c">#</th>
          <th>Item</th>
          <th class="c">Unit</th>
          <th class="r">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Disc</th>
          <th class="r">GST</th>
          <th class="r">Taxable</th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Summary: words + totals -->
    <div class="summary">
      <div class="words">
        <div>
          <div class="lbl">Amount in Words</div>
          <div class="val">${escapeHtml(amountInWords(totalAmount))}</div>
        </div>
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
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer: terms + signature -->
    <div class="foot">
      <div class="col terms">
        <span class="lbl">Terms &amp; Conditions</span>
        ${escapeHtml(labels.terms)}
      </div>
      <div class="col">
        <span class="lbl">For ${escapeHtml(store.store_name || 'Store')}</span>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>

    <div class="thanks">${escapeHtml(labels.thanks)}</div>

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
