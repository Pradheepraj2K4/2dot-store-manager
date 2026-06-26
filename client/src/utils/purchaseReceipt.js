/**
 * Purchase Voucher Receipt printer
 *
 * Generates a print-ready HTML page for an item purchase.
 * `format`: 'a5' | 'a4' | 'thermal'
 *
 *  - thermal : 80mm POS roll, monospaced
 *  - a4 / a5 : standard monochrome purchase voucher with two-column header,
 *              Supplier block, ruled items table and totals panel
 */

function fmt(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
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

function amountInWords(n) {
  const x0 = Math.round((parseFloat(n) || 0) * 100) / 100;
  const rupees = Math.floor(x0);
  const paise = Math.round((x0 - rupees) * 100);
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

export function buildPurchaseReceiptHtml({
  purchase,
  store = {},
  logoDataUrl = null,
  format = 'thermal',
}) {
  const ps = PAGE_SIZES[format] || PAGE_SIZES.thermal;
  if (format === 'thermal') return buildThermal({ purchase, store, logoDataUrl, ps });
  return buildPaper({ purchase, store, logoDataUrl, ps, format });
}

// ───────────────────────────────────────────────────────────────────────────
// Thermal (80mm) — POS-style monospaced voucher
// ───────────────────────────────────────────────────────────────────────────
function buildThermal({ purchase, store, logoDataUrl, ps }) {
  const items = Array.isArray(purchase.items) ? purchase.items : [];
  const totalQty          = items.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalItemDiscount = parseFloat(purchase.total_discount) || 0;
  const totalBillDiscount = parseFloat(purchase.bill_discount) || 0;
  const totalAmount       = parseFloat(purchase.total_amount) || 0;

  const subtotal = items.reduce((s, l) => {
    const rate = parseFloat(l.rate) || 0;
    const qty  = parseFloat(l.quantity) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    return s + rate * qty * (1 - disc / 100);
  }, 0);

  const gstSlabs = {};
  items.forEach(l => {
    const rate = parseFloat(l.gst_percent) || 0;
    if (rate > 0) gstSlabs[rate] = (gstSlabs[rate] || 0) + (parseFloat(l.gst_amount) || 0);
  });
  const gstSlabRows = Object.entries(gstSlabs)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([rate, amt]) => {
      const halfAmt = Math.round(amt / 2 * 100) / 100;
      const halfPct = parseFloat(rate) / 2;
      return `<div class="row"><span>CGST ${halfPct}%</span><span>${money(halfAmt)}</span></div>` +
             `<div class="row"><span>SGST ${halfPct}%</span><span>${money(halfAmt)}</span></div>`;
    }).join('');

  const logoHtml = logoDataUrl
    ? `<div class="logo-wrap"><img src="${logoDataUrl}" alt="Logo"/></div>`
    : '';

  const itemsHtml = `
    <div class="items">
      <div class="items-head">
        <span class="ih-item">Item</span>
        <span class="ih-amt">Amount</span>
      </div>
      <div class="rule-solid"></div>
      ${items.map((l, i) => {
        const rate = parseFloat(l.rate) || 0;
        const qty  = parseFloat(l.quantity) || 0;
        const disc = parseFloat(l.discount_percent) || 0;
        const gst  = parseFloat(l.gst_percent) || 0;
        const meta = [
          `${num(qty, qty % 1 === 0 ? 0 : 2)} ${escapeHtml(l.unit || '')} x ${money(rate)}`,
          disc ? `disc ${num(disc, disc % 1 === 0 ? 0 : 2)}%` : '',
          gst  ? `gst ${num(gst, gst % 1 === 0 ? 0 : 2)}%`   : '',
        ].filter(Boolean).join('  ');
        return `
          <div class="row item-row">
            <span class="i-name">${i + 1}. ${escapeHtml(l.item_name || '')}</span>
            <span class="i-amt">${money(l.amount)}</span>
          </div>
          <div class="row item-meta">
            <span>${meta}</span>
          </div>
        `;
      }).join('')}
      <div class="rule-solid"></div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Purchase ${purchase.purchase_number || ''}</title>
  <style>
    @page { size: ${ps.cssSize}; margin: 3mm 2mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body, body * { color: #000 !important; background: transparent !important; border-color: #000 !important; }
    body {
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: 9pt;
      line-height: 1.35;
      width: ${ps.width};
      filter: grayscale(100%);
      -webkit-filter: grayscale(100%);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen { html, body { width: 100%; max-width: 100%; overflow-x: hidden; } }
    .page { width: 100%; padding: 1mm 2mm; }

    .logo-wrap { text-align: center; margin-bottom: 1.5mm; }
    .logo-wrap img { max-height: 12mm; max-width: 100%; object-fit: contain; filter: grayscale(100%) contrast(1.15); }

    .header { text-align: center; }
    .store-name { font-size: 13pt; font-weight: 900; letter-spacing: 0.5px; }
    .store-meta { font-size: 8pt; margin-top: 0.8mm; line-height: 1.35; }

    .title-band {
      text-align: center;
      font-weight: 800;
      letter-spacing: 2.5px;
      font-size: 9.5pt;
      text-transform: uppercase;
      padding: 1mm 0;
      margin: 1.5mm 0 1mm;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }

    .rule-dash  { border-top: 1px dashed #000; margin: 1mm 0; }
    .rule-solid { border-top: 1px solid #000;  margin: 0.8mm 0; }

    .row { display: flex; justify-content: space-between; gap: 2mm; font-size: 9pt; }
    .row .lbl { color: #000; }
    .row .val { font-weight: 700; text-align: right; }

    .meta { margin: 0.5mm 0; }
    .meta .row { padding: 0.2mm 0; font-size: 8.5pt; }

    .items { margin: 0.5mm 0; }
    .items-head { display: flex; justify-content: space-between; font-weight: 800; font-size: 8.5pt; padding: 0.5mm 0; }
    .ih-item { flex: 1; }
    .ih-amt  { white-space: nowrap; }

    .item-row { font-weight: 700; padding-top: 0.6mm; }
    .i-name { flex: 1; word-break: break-word; padding-right: 2mm; }
    .i-amt  { white-space: nowrap; }
    .item-meta { font-size: 8pt; padding-bottom: 0.6mm; }

    .totals { margin-top: 0.5mm; }
    .totals .row { padding: 0.4mm 0; }
    .totals .grand {
      margin-top: 1mm; padding: 1.4mm 0;
      border-top: 3px double #000; border-bottom: 3px double #000;
      font-weight: 900; font-size: 14pt;
      letter-spacing: 0.4px;
    }
    .totals .grand .lbl { text-transform: uppercase; }

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
      text-align: center;
      margin-top: 2mm;
      padding-top: 1.5mm;
      border-top: 1px dashed #000;
      font-size: 8.5pt;
      line-height: 1.4;
    }
    .stamp { font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
    .system-tag { margin-top: 1mm; font-size: 7pt; letter-spacing: 1px; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    ${logoHtml}
    <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
    <div class="store-meta">
      ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
      ${store.phone ? `Ph: ${escapeHtml(store.phone)}` : ''}${store.phone && store.email ? '  ·  ' : ''}${store.email ? escapeHtml(store.email) : ''}
      ${store.gst_tax_id ? `<br>GSTIN: ${escapeHtml(store.gst_tax_id)}` : ''}
    </div>
  </div>

  <div class="title-band">Purchase Voucher</div>

  <div class="meta">
    <div class="row"><span class="lbl">Voucher No.</span><span class="val">${escapeHtml(purchase.purchase_number || '—')}</span></div>
    <div class="row"><span class="lbl">Date</span><span class="val">${fmt(purchase.date)}${purchase.time ? '  ' + escapeHtml(purchase.time) : ''}</span></div>
    <div class="row"><span class="lbl">Supplier</span><span class="val">${escapeHtml(purchase.ledger_name || '—')}</span></div>
    ${purchase.bill_number ? `<div class="row"><span class="lbl">Bill No.</span><span class="val">${escapeHtml(purchase.bill_number)}</span></div>` : ''}
  </div>

  <div class="rule-dash"></div>

  ${itemsHtml}

  <div class="totals">
    <div class="row"><span class="lbl">Qty / Items</span><span class="val">${num(totalQty, totalQty % 1 === 0 ? 0 : 2)} / ${items.length}</span></div>
    <div class="row"><span class="lbl">Subtotal</span><span class="val">${money(subtotal)}</span></div>
    ${totalItemDiscount > 0 ? `<div class="row"><span class="lbl">Item Discount</span><span class="val">- ${money(totalItemDiscount)}</span></div>` : ''}
    ${gstSlabRows}
    ${totalBillDiscount > 0 ? `<div class="row"><span class="lbl">Bill Discount</span><span class="val">- ${money(totalBillDiscount)}</span></div>` : ''}
    <div class="row grand"><span class="lbl">Total</span><span class="val">${money(totalAmount)}</span></div>
  </div>

  <div class="words">${escapeHtml(amountInWords(totalAmount))}</div>

  ${purchase.notes ? `<div class="notes"><span class="lbl">Notes:</span> ${escapeHtml(purchase.notes)}</div>` : ''}

  <div class="footer">
    <div class="stamp">Stock In — Internal Record</div>
    <div class="system-tag">* * *</div>
  </div>

</div>
</body>
</html>`;
}

// ───────────────────────────────────────────────────────────────────────────
// A4 / A5 — standard monochrome purchase voucher
// ───────────────────────────────────────────────────────────────────────────
function buildPaper({ purchase, store, logoDataUrl, ps, format }) {
  const isA5 = format === 'a5';
  const items = Array.isArray(purchase.items) ? purchase.items : [];

  const totalItemDiscount = parseFloat(purchase.total_discount) || 0;
  const totalBillDiscount = parseFloat(purchase.bill_discount) || 0;
  const totalAmount       = parseFloat(purchase.total_amount) || 0;

  const subtotal = items.reduce((s, l) => {
    const rate = parseFloat(l.rate) || 0;
    const qty  = parseFloat(l.quantity) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    return s + rate * qty * (1 - disc / 100);
  }, 0);

  const gstSlabs = {};
  items.forEach(l => {
    const rate = parseFloat(l.gst_percent) || 0;
    if (rate > 0) gstSlabs[rate] = (gstSlabs[rate] || 0) + (parseFloat(l.gst_amount) || 0);
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

  const baseFs   = isA5 ? '9pt'  : '10.5pt';
  const titleFs  = isA5 ? '15pt' : '20pt';
  const headFs   = isA5 ? '8.5pt' : '9.5pt';
  const grandFs  = isA5 ? '12pt' : '14pt';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Purchase ${purchase.purchase_number || ''}</title>
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
    @media screen { html, body { width: 100%; max-width: 100%; overflow-x: hidden; } }
    .page { width: 100%; }

    .doc { border: 1px solid #000; }

    .head {
      display: grid;
      grid-template-columns: 6fr 4fr;
      border-bottom: 1px solid #000;
    }
    .head .left, .head .right { padding: ${isA5 ? '4mm' : '6mm'}; }
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

    .party {
      padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'};
      border-bottom: 1px solid #000;
    }
    .party-title { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 1mm; }
    .party-name { font-size: ${isA5 ? '10.5pt' : '12pt'}; font-weight: 700; }

    .items { width: 100%; border-collapse: collapse; }
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

    .items col.col-no    { width: ${isA5 ? '8mm'  : '10mm'}; }
    .items col.col-name  { width: auto; }
    .items col.col-unit  { width: ${isA5 ? '12mm' : '15mm'}; }
    .items col.col-qty   { width: ${isA5 ? '14mm' : '18mm'}; }
    .items col.col-rate  { width: ${isA5 ? '20mm' : '24mm'}; }
    .items col.col-disc  { width: ${isA5 ? '14mm' : '16mm'}; }
    .items col.col-gst   { width: ${isA5 ? '14mm' : '16mm'}; }
    .items col.col-tax   { width: ${isA5 ? '22mm' : '26mm'}; }
    .items col.col-amt   { width: ${isA5 ? '24mm' : '30mm'}; }

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

    .foot {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #000;
      font-size: ${isA5 ? '8pt' : '9pt'};
    }
    .foot .col { padding: ${isA5 ? '4mm' : '6mm'}; }
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

    <div class="head">
      <div class="left">
        <div class="store-row">
          ${logoHtml}
          <div>
            <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
            <div class="store-meta">
              ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
              ${store.phone ? `Phone: ${escapeHtml(store.phone)}<br>` : ''}
              ${store.email ? `Email: ${escapeHtml(store.email)}<br>` : ''}
              ${store.gst_tax_id ? `GSTIN: ${escapeHtml(store.gst_tax_id)}` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="right">
        <div class="doc-title">Purchase Voucher</div>
        <div class="doc-meta">
          <div><span class="lbl">Voucher No.</span><span class="val">${escapeHtml(purchase.purchase_number || '—')}</span></div>
          <div><span class="lbl">Date</span><span class="val">${fmt(purchase.date)}${purchase.time ? ' · ' + escapeHtml(purchase.time) : ''}</span></div>
          ${purchase.bill_number ? `<div><span class="lbl">Supplier Bill #</span><span class="val">${escapeHtml(purchase.bill_number)}</span></div>` : ''}
          <div><span class="lbl">Items</span><span class="val">${items.length}</span></div>
        </div>
      </div>
    </div>

    <div class="party">
      <div class="party-title">Supplier</div>
      <div class="party-name">${escapeHtml(purchase.ledger_name || '—')}</div>
    </div>

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

    <div class="summary">
      <div class="words">
        <div>
          <div class="lbl">Amount in Words</div>
          <div class="val">${escapeHtml(amountInWords(totalAmount))}</div>
        </div>
        ${purchase.notes ? `<div class="notes"><span class="lbl">Notes:</span> ${escapeHtml(purchase.notes)}</div>` : ''}
      </div>
      <div class="totals">
        <table class="totals-table">
          <tbody>
            <tr><td>Subtotal</td><td class="r">${money(subtotal)}</td></tr>
            ${totalItemDiscount > 0 ? `<tr><td>Item Discount</td><td class="r">− ${money(totalItemDiscount)}</td></tr>` : ''}
            ${gstSlabRows}
            ${totalBillDiscount > 0 ? `<tr><td>Bill Discount</td><td class="r">− ${money(totalBillDiscount)}</td></tr>` : ''}
            <tr class="grand"><td>Grand Total</td><td class="r">${money(totalAmount)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="foot">
      <div class="col terms">
        <span class="lbl">Notes</span>
        Internal stock-in record. Verify quantities and supplier bill against entry before filing.
      </div>
      <div class="col">
        <span class="lbl">For ${escapeHtml(store.store_name || 'Store')}</span>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>

    <div class="thanks">Stock In — Internal Record</div>

  </div>
</div>
</body>
</html>`;
}
