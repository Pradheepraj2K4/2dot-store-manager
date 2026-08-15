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

import { mergeReceiptConfig } from './receiptConfig';

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
  config = null,
}) {
  const ps = PAGE_SIZES[format] || PAGE_SIZES.thermal;
  const fontFamily = mergeReceiptConfig(config).paper.fontFamily || "'Helvetica Neue', Helvetica, Arial, sans-serif";
  if (format === 'thermal') return buildThermal({ purchase, store, logoDataUrl, ps });
  return buildPaper({ purchase, store, logoDataUrl, ps, format, fontFamily });
}

// ───────────────────────────────────────────────────────────────────────────
// Thermal (80mm) — POS-style monospaced voucher
// ───────────────────────────────────────────────────────────────────────────
function buildThermal({ purchase, store, logoDataUrl, ps }) {
  const items = Array.isArray(purchase.items) ? purchase.items : [];
  const totalQty          = items.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalItemDiscount = parseFloat(purchase.total_discount) || 0;
  const totalBillDiscount = parseFloat(purchase.bill_discount) || 0;
  const totalFreight      = parseFloat(purchase.freight_charge) || 0;
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
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
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
      ${store.place ? `${escapeHtml(store.place)}<br>` : ''}
      ${store.phone ? `Ph: ${escapeHtml(store.phone)}` : ''}${store.phone && store.email ? '  ·  ' : ''}${store.email ? escapeHtml(store.email) : ''}
      ${store.gst_tax_id ? `<br>GSTIN: ${escapeHtml(store.gst_tax_id)}` : ''}
    </div>
  </div>

  <div class="title-band">Purchase Voucher</div>

  <div class="meta">
    <div class="row"><span class="lbl">Voucher No.</span><span class="val">${escapeHtml(purchase.purchase_number || '—')}</span></div>
    <div class="row"><span class="lbl">Date</span><span class="val">${fmt(purchase.date)}${purchase.time ? '  ' + escapeHtml(purchase.time) : ''}</span></div>
    <div class="row"><span class="lbl">Supplier</span><span class="val">${escapeHtml(purchase.ledger_name || '—')}</span></div>
    ${purchase.po_number ? `<div class="row"><span class="lbl">PO No.</span><span class="val">${escapeHtml(purchase.po_number)}</span></div>` : ''}
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
    ${totalFreight > 0 ? `<div class="row"><span class="lbl">Freight Charge</span><span class="val">+ ${money(totalFreight)}</span></div>` : ''}
    <div class="row grand"><span class="lbl">Total</span><span class="val">${money(totalAmount)}</span></div>
  </div>

  <div class="words">${escapeHtml(amountInWords(totalAmount))}</div>

  ${purchase.notes ? `<div class="notes"><span class="lbl">Notes:</span> ${escapeHtml(purchase.notes)}</div>` : ''}

  <div class="footer">
    <div class="stamp">Stock In — Internal Record</div>
    <div class="system-tag">* * *</div>
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
// A4 / A5 — standard monochrome purchase voucher
// ───────────────────────────────────────────────────────────────────────────
function buildPaper({ purchase, store, logoDataUrl, ps, format, fontFamily }) {
  const isA5 = format === 'a5';
  const items = Array.isArray(purchase.items) ? purchase.items : [];

  const totalItemDiscount = parseFloat(purchase.total_discount) || 0;
  const totalBillDiscount = parseFloat(purchase.bill_discount) || 0;
  const totalDiscount     = totalItemDiscount + totalBillDiscount;
  const totalFreight      = parseFloat(purchase.freight_charge) || 0;
  const totalAmount       = parseFloat(purchase.total_amount) || 0;
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

  const logoHtml = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="Logo"/>`
    : '';

  const itemsRows = items.map((l, i) => {
    const rate = parseFloat(l.rate) || 0;
    const qty  = parseFloat(l.quantity) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    const gst  = parseFloat(l.gst_percent) || 0;
    const mrp  = parseFloat(l.mrp) || 0;
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="nm">${escapeHtml(l.item_name || '')}</td>
        <td class="c">${escapeHtml(l.hsn_code || l.hsn || '')}</td>
        <td class="c">${escapeHtml(l.unit || '')}</td>
        <td class="r">${mrp ? num(mrp) : '—'}</td>
        <td class="r">${num(qty, qty % 1 === 0 ? 0 : 2)}</td>
        <td class="r">${num(rate)}</td>
        <td class="c">${gst ? num(gst, 0) : '0'}</td>
        <td class="c">${disc ? num(disc, 0) : '0'}</td>
        <td class="r">${num(l.amount)}</td>
      </tr>
    `;
  }).join('');

  // Blank filler row keeps the items table at a fixed height regardless of the
  // number of lines, so short invoices keep the same tall ruled body as long ones.
  const fillerRow = `
      <tr class="filler">
        <td class="c"></td>
        <td class="nm remarks">Remarks:</td>
        <td class="c"></td>
        <td class="c"></td>
        <td class="r"></td>
        <td class="r"></td>
        <td class="r"></td>
        <td class="c"></td>
        <td class="c"></td>
        <td class="r"></td>
      </tr>`;

  const contactBits = [
    store.phone ? `Cell: ${escapeHtml(store.phone)}` : '',
    store.email ? `email: ${escapeHtml(store.email)}` : '',
  ].filter(Boolean).join('<br>');

  const termsLines = (store.terms_conditions && String(store.terms_conditions).trim())
    ? String(store.terms_conditions).split('\n').map((t) => t.trim()).filter(Boolean)
    : ['Goods once sold cannot be taken back.', 'Subject to local jurisdiction.', 'Our responsibility ceases on delivery of goods.'];
  const termsHtml = termsLines.map((t) => `<li>${escapeHtml(t)}</li>`).join('');

  const itemsTableHeight = isA5 ? '58mm' : '120mm';

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
      font-family: ${fontFamily};
      font-size: ${baseFs};
      line-height: 1.4;
      width: ${ps.width};
    }
    @media screen { html { background: #eef0f2; } body { margin: 0 auto; box-shadow: 0 0 6px rgba(0,0,0,0.15); } }
    .page { width: 100%; }

    .doc { border: 1.4px solid #000; }

    .head {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      border-bottom: 1.4px solid #000;
    }
    .head .left { padding: ${isA5 ? '3mm 4mm' : '4mm 6mm'}; display: flex; align-items: center; gap: 4mm; }
    .head .right {
      border-left: 1.4px solid #000;
      display: flex;
      flex-direction: column;
    }
    .logo { max-height: ${isA5 ? '14mm' : '18mm'}; max-width: ${isA5 ? '24mm' : '32mm'}; object-fit: contain; filter: grayscale(100%); }
    .store-name { font-size: ${titleFs}; font-weight: 800; letter-spacing: 0.4px; line-height: 1.1; }
    .store-meta { font-size: ${isA5 ? '8pt' : '9pt'}; margin-top: 1mm; line-height: 1.4; }

    .doc-title {
      font-size: ${isA5 ? '13pt' : '17pt'};
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-align: center;
      padding: ${isA5 ? '2mm' : '3mm'};
      border-bottom: 1.4px solid #000;
    }
    .doc-meta { font-size: ${isA5 ? '8.5pt' : '9.5pt'}; line-height: 1.5; padding: ${isA5 ? '2mm 3mm' : '3mm 4mm'}; flex: 1; }
    .doc-meta div { display: flex; justify-content: space-between; gap: 3mm; padding: 0.4mm 0; }
    .doc-meta .lbl { font-weight: 700; }
    .doc-meta .val { font-weight: 700; text-align: right; }

    .gst-row {
      border-bottom: 1.4px solid #000;
      font-size: ${headFs};
      font-weight: 700;
    }
    .gst-row > div { padding: ${isA5 ? '1.5mm 4mm' : '2mm 6mm'}; }

    .parties { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.4px solid #000; }
    .party { padding: ${isA5 ? '2.5mm 4mm' : '3mm 6mm'}; }
    .party + .party { border-left: 1.4px solid #000; }
    .party-title { font-size: ${headFs}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 1mm; text-align: center; }
    .party-name { font-size: ${isA5 ? '10pt' : '11.5pt'}; font-weight: 700; }
    .party-meta { font-size: ${isA5 ? '8pt' : '9pt'}; line-height: 1.4; margin-top: 0.5mm; }

    .items { width: 100%; border-collapse: collapse; table-layout: fixed; height: ${itemsTableHeight}; }
    .items th, .items td {
      padding: ${isA5 ? '1.2mm 1.6mm' : '1.6mm 2mm'};
      border-right: 1px solid #000;
      vertical-align: top;
      font-size: ${isA5 ? '8pt' : '9pt'};
      word-break: break-word;
    }
    .items th:last-child, .items td:last-child { border-right: none; }
    .items thead th {
      font-size: ${headFs};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1.4px solid #000;
      text-align: center;
      background: #f2f2f2;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .items tbody td { border-bottom: none; }
    .items .c { text-align: center; }
    .items .r { text-align: right; }
    .items td.nm { font-weight: 600; text-align: left; }
    .items .filler td { height: 100%; }
    .items .filler .remarks { vertical-align: bottom; font-weight: 700; }

    .items col.col-no   { width: ${isA5 ? '7mm'  : '9mm'}; }
    .items col.col-name { width: auto; }
    .items col.col-hsn  { width: ${isA5 ? '14mm' : '18mm'}; }
    .items col.col-unit { width: ${isA5 ? '12mm' : '15mm'}; }
    .items col.col-mrp  { width: ${isA5 ? '13mm' : '16mm'}; }
    .items col.col-qty  { width: ${isA5 ? '11mm' : '13mm'}; }
    .items col.col-rate { width: ${isA5 ? '14mm' : '18mm'}; }
    .items col.col-gst  { width: ${isA5 ? '10mm' : '12mm'}; }
    .items col.col-dis  { width: ${isA5 ? '10mm' : '12mm'}; }
    .items col.col-amt  { width: ${isA5 ? '16mm' : '22mm'}; }

    .summary { display: grid; grid-template-columns: 1fr ${isA5 ? '58mm' : '76mm'}; border-top: 1.4px solid #000; }
    .summary .sum-left { border-right: 1.4px solid #000; display: flex; flex-direction: column; }

    .tax-summary { width: 100%; border-collapse: collapse; }
    .tax-summary th, .tax-summary td {
      border: 1px solid #000; padding: ${isA5 ? '1mm 1.5mm' : '1.4mm 2mm'};
      font-size: ${isA5 ? '7.5pt' : '8.5pt'};
    }
    .tax-summary th { font-weight: 700; text-transform: uppercase; text-align: center; }
    .tax-summary .c { text-align: center; }
    .tax-summary .r { text-align: right; }
    .tax-summary td:first-child, .tax-summary th:first-child { border-left: none; }
    .tax-summary td:last-child, .tax-summary th:last-child { border-right: none; }
    .tax-summary tr:first-child th { border-top: none; }

    .pay { padding: ${isA5 ? '2.5mm 4mm' : '3mm 6mm'}; font-size: ${isA5 ? '8pt' : '9pt'}; line-height: 1.5; flex: 1; }
    .pay .lbl { font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; text-decoration: underline; margin-bottom: 1mm; display: block; }

    .totals-table { width: 100%; border-collapse: collapse; height: 100%; }
    .totals-table td {
      padding: ${isA5 ? '1.4mm 3mm' : '1.8mm 4mm'};
      font-size: ${isA5 ? '9pt' : '10pt'};
    }
    .totals-table td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    .totals-table td.k { text-align: left; }
    .totals-table tr.grand td {
      font-weight: 800;
      font-size: ${grandFs};
      border-top: 1.4px solid #000;
      padding-top: ${isA5 ? '2mm' : '2.6mm'};
      padding-bottom: ${isA5 ? '2mm' : '2.6mm'};
      text-transform: uppercase;
    }

    .words {
      padding: ${isA5 ? '2mm 4mm' : '2.5mm 6mm'};
      border-top: 1.4px solid #000;
      font-size: ${isA5 ? '8.5pt' : '9.5pt'};
    }
    .words .lbl { font-weight: 700; }

    .foot {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      border-top: 1.4px solid #000;
      font-size: ${isA5 ? '8pt' : '9pt'};
    }
    .foot .col { padding: ${isA5 ? '3mm' : '4mm'}; }
    .foot .col + .col { border-left: 1.4px solid #000; }
    .foot .sig { text-align: center; display: flex; flex-direction: column; justify-content: space-between; }
    .foot .lbl { text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-bottom: 1mm; display: block; }
    .foot .sig-space { margin-top: ${isA5 ? '10mm' : '14mm'}; }
    .terms { line-height: 1.5; }
    .terms ol { margin: 0.5mm 0 0 4mm; padding: 0; }

    .system-tag {
      text-align: center;
      padding: ${isA5 ? '1.5mm' : '2mm'};
      font-size: ${isA5 ? '7pt' : '8pt'};
      letter-spacing: 1px;
      text-transform: uppercase;
      border-top: 1.4px solid #000;
      font-weight: 700;
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
        <div class="doc-title">Purchase Invoice</div>
        <div class="doc-meta">
          <div><span class="lbl">Invoice No.</span><span class="val">${escapeHtml(purchase.purchase_number || '—')}</span></div>
          <div><span class="lbl">Date</span><span class="val">${fmt(purchase.date)}${purchase.time ? '  ' + escapeHtml(purchase.time) : ''}</span></div>
          ${purchase.po_number ? `<div><span class="lbl">PO No.</span><span class="val">${escapeHtml(purchase.po_number)}</span></div>` : ''}
          ${purchase.bill_number ? `<div><span class="lbl">Supplier Bill No.</span><span class="val">${escapeHtml(purchase.bill_number)}</span></div>` : ''}
        </div>
      </div>
    </div>

    <div class="gst-row">
      <div>GSTIN: ${escapeHtml(store.gst_tax_id || '—')}</div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-title">Supplier Name &amp; Address</div>
        <div class="party-name">${escapeHtml(purchase.ledger_name || '—')}</div>
      </div>
      <div class="party">
        <div class="party-title">Delivered To</div>
        <div class="party-name">${escapeHtml(store.store_name || 'Store')}</div>
        <div class="party-meta">
          ${store.address ? `${escapeHtml(store.address).replace(/\n/g, '<br>')}<br>` : ''}
          ${store.place ? `${escapeHtml(store.place)}` : ''}
        </div>
      </div>
    </div>

    <table class="items">
      <colgroup>
        <col class="col-no"/>
        <col class="col-name"/>
        <col class="col-hsn"/>
        <col class="col-unit"/>
        <col class="col-mrp"/>
        <col class="col-qty"/>
        <col class="col-rate"/>
        <col class="col-gst"/>
        <col class="col-dis"/>
        <col class="col-amt"/>
      </colgroup>
      <thead>
        <tr>
          <th>S.N</th>
          <th>Item Description</th>
          <th>HSN</th>
          <th>Unit</th>
          <th>MRP</th>
          <th>Qty</th>
          <th>Base Rate</th>
          <th>GST%</th>
          <th>DIS%</th>
          <th>Amount</th>
        </tr>
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
          <span class="lbl">For Making Payment</span>
          ${store.upi_id ? `Gpay / UPI: ${escapeHtml(store.upi_id)}<br>` : ''}
          ${contactBits}
        </div>
      </div>
      <div class="totals">
        <table class="totals-table">
          <tbody>
            <tr><td class="k">Total Amount</td><td class="r">${num(taxableTotal)}</td></tr>
            <tr><td class="k">Less : Discount</td><td class="r">${num(totalDiscount)}</td></tr>
            <tr><td class="k">Add : CGST</td><td class="r">${num(cgstTotal)}</td></tr>
            <tr><td class="k">Add : SGST</td><td class="r">${num(sgstTotal)}</td></tr>
            <tr><td class="k">Add : IGST</td><td class="r">${num(0)}</td></tr>
            <tr><td class="k">Add : Freight</td><td class="r">${num(totalFreight)}</td></tr>
            <tr><td class="k">Net Nos</td><td class="r">${num(totalQty, totalQty % 1 === 0 ? 0 : 2)}</td></tr>
            <tr class="grand"><td class="k">Net Value</td><td class="r">${num(totalAmount)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="words">
      <span class="lbl">Rupees in Words :</span> ${escapeHtml(amountInWords(totalAmount))}
    </div>

    <div class="foot">
      <div class="col terms">
        <span class="lbl">Terms &amp; Condition</span>
        <ol>
          ${termsHtml}
        </ol>
      </div>
      <div class="col sig">
        <span class="lbl">Receiver Signature</span>
        <div class="sig-space"></div>
      </div>
      <div class="col sig">
        <span class="lbl">For ${escapeHtml(store.store_name || 'Store')}</span>
        <div class="sig-space"></div>
      </div>
    </div>

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
