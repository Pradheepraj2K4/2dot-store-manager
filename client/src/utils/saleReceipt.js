/**
 * Sale / Invoice Receipt printer
 *
 * Generates a print-ready HTML page for an item sale.
 * Paper size is driven by `format`: 'a5' | 'a4' | 'thermal'
 *
 * Thermal layout is optimised for 80mm rolls and prints each line item
 * stacked: name on top, "qty x rate" with the line total right-aligned
 * below, mirroring conventions of retail POS receipts.
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const PAGE_SIZES = {
  a5:      { cssSize: 'A5',        width: '148mm' },
  a4:      { cssSize: 'A4',        width: '210mm' },
  thermal: { cssSize: '80mm auto', width: '76mm'  },
};

export function buildSaleReceiptHtml({
  sale,
  ledgerName,
  store = {},
  logoDataUrl = null,
  format = 'thermal',
}) {
  const ps = PAGE_SIZES[format] || PAGE_SIZES.thermal;
  const isThermal = format === 'thermal';
  const primaryColor = '#16A34A';

  const headerFontSize = isThermal ? '12pt' : '18pt';
  const bodyFontSize   = isThermal ? '9pt'  : '11pt';
  const amountFontSize = isThermal ? '13pt' : '17pt';

  const items = Array.isArray(sale.items) ? sale.items : [];

  const totalQty = items.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalItemDiscount = parseFloat(sale.total_discount) || 0;
  const totalBillDiscount = parseFloat(sale.bill_discount) || 0;
  const totalGst = parseFloat(sale.total_gst) || 0;
  const totalAmount = parseFloat(sale.total_amount) || 0;

  // Group GST by rate for per-slab CGST/SGST display
  const gstSlabs = {};
  items.forEach(l => {
    const rate = parseFloat(l.gst_percent) || 0;
    if (rate > 0) {
      if (!gstSlabs[rate]) gstSlabs[rate] = 0;
      gstSlabs[rate] += parseFloat(l.gst_amount) || 0;
    }
  });
  const gstSlabRows = Object.entries(gstSlabs)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([rate, amt]) => {
      const halfAmt = Math.round(amt / 2 * 100) / 100;
      const halfPct = parseFloat(rate) / 2;
      return `<div class="row subtle"><span>CGST (${halfPct}%)</span><span>+ ${money(halfAmt)}</span></div>` +
             `<div class="row subtle"><span>SGST (${halfPct}%)</span><span>+ ${money(halfAmt)}</span></div>`;
    }).join('');

  const logoHtml = logoDataUrl
    ? `<div class="logo-wrap"><img src="${logoDataUrl}" alt="Logo"/></div>`
    : '';

  // ── Items markup ────────────────────────────────────────────────────
  let itemsHtml = '';
  if (isThermal) {
    // Stacked line layout — best for 80mm
    itemsHtml = `
      <div class="thermal-items">
        <div class="thermal-items-head">
          <span>Item</span>
          <span>Amount</span>
        </div>
        ${items.map((l, i) => {
          const rate = parseFloat(l.rate) || 0;
          const qty = parseFloat(l.quantity) || 0;
          const disc = parseFloat(l.discount_percent) || 0;
          const gst = parseFloat(l.gst_percent) || 0;
          const meta = [
            `${qty} ${escapeHtml(l.unit || '')} × ${money(rate)}`,
            disc ? `disc ${disc}%` : '',
            gst ? `gst ${gst}%` : '',
          ].filter(Boolean).join('  ');
          return `
            <div class="t-item">
              <div class="t-item-top">
                <span class="t-item-name">${i + 1}. ${escapeHtml(l.item_name || '')}</span>
                <span class="t-item-amt">${money(l.amount)}</span>
              </div>
              <div class="t-item-meta">${meta}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else {
    // Tabular layout for A4 / A5
    itemsHtml = `
      <table class="items-table">
        <thead>
          <tr>
            <th class="ta-l">#</th>
            <th class="ta-l">Item</th>
            <th class="ta-r">Qty</th>
            <th class="ta-r">Rate</th>
            <th class="ta-r">Disc%</th>
            <th class="ta-r">GST%</th>
            <th class="ta-r">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((l, i) => `
            <tr>
              <td class="ta-l">${i + 1}</td>
              <td class="ta-l">${escapeHtml(l.item_name || '')}<div class="item-sub">${escapeHtml(l.unit || '')}</div></td>
              <td class="ta-r">${parseFloat(l.quantity) || 0}</td>
              <td class="ta-r">${money(l.rate)}</td>
              <td class="ta-r">${parseFloat(l.discount_percent) || 0}</td>
              <td class="ta-r">${parseFloat(l.gst_percent) || 0}</td>
              <td class="ta-r">${money(l.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${sale.sale_number || ''}</title>
  <style>
    @page { size: ${ps.cssSize}; margin: ${isThermal ? '4mm 3mm' : '12mm'}; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isThermal ? "'Courier New', monospace" : "'Segoe UI', system-ui, -apple-system, sans-serif"};
      font-size: ${bodyFontSize};
      color: ${isThermal ? '#000' : '#1a1a1a'};
      width: ${ps.width};
      ${isThermal ? `
      /* Force pure grayscale rendering — typical thermal print look */
      filter: grayscale(100%);
      -webkit-filter: grayscale(100%);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      ` : ''}
    }
    ${isThermal ? `
    body, body * {
      color: #000 !important;
      background: transparent !important;
      border-color: #000 !important;
    }
    .logo-wrap img { filter: grayscale(100%) contrast(1.1); -webkit-filter: grayscale(100%) contrast(1.1); }
    ` : ''}
    @media screen { html, body { width: 100%; max-width: 100%; overflow-x: hidden; } }
    .page { width: 100%; padding: ${isThermal ? '2mm 3mm' : '4mm 14mm'}; }

    /* ── Logo ── */
    .logo-wrap { text-align: center; margin-bottom: ${isThermal ? '2mm' : '3mm'}; }
    .logo-wrap img { max-height: ${isThermal ? '12mm' : '20mm'}; max-width: 100%; object-fit: contain; }

    /* ── Header ── */
    .header {
      text-align: center;
      padding-bottom: ${isThermal ? '2mm' : '5mm'};
      margin-bottom: ${isThermal ? '2mm' : '4mm'};
      border-bottom: ${isThermal ? '1px dashed #444' : `2px solid ${primaryColor}`};
    }
    .store-name {
      font-size: ${headerFontSize};
      font-weight: 800;
      color: ${isThermal ? '#000' : primaryColor};
      letter-spacing: 0.5px;
    }
    .store-meta {
      font-size: ${isThermal ? '8pt' : '9pt'};
      color: ${isThermal ? '#222' : '#555'};
      margin-top: 1mm;
      line-height: 1.4;
    }

    /* ── Title ── */
    .receipt-title {
      text-align: center;
      font-size: ${isThermal ? '10pt' : '11pt'};
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: ${isThermal ? '1.5mm 0' : '4mm 0 2mm'};
      color: #111;
    }

    /* ── Meta rows ── */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${isThermal ? '0.5mm 3mm' : '2mm 6mm'};
      margin: ${isThermal ? '2mm 0' : '3mm 0'};
      font-size: ${isThermal ? '8.5pt' : bodyFontSize};
    }
    .meta-grid .lbl { color: ${isThermal ? '#222' : '#666'}; }
    .meta-grid .val { font-weight: 700; text-align: right; }

    .divider { border: none; border-top: 1px dashed ${isThermal ? '#000' : '#bbb'}; margin: ${isThermal ? '2mm 0' : '4mm 0'}; }

    /* ── Items table (a4/a5) ── */
    .items-table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: ${bodyFontSize}; }
    .items-table th, .items-table td { padding: 2mm 1.5mm; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    .items-table th { background: #f7f7f7; font-weight: 700; }
    .items-table .ta-l { text-align: left; }
    .items-table .ta-r { text-align: right; }
    .item-sub { font-size: ${isThermal ? '7.5pt' : '8.5pt'}; color: #888; }

    /* ── Thermal items ── */
    .thermal-items { margin: 2mm 0; }
    .thermal-items-head {
      display: flex; justify-content: space-between;
      font-weight: 700; font-size: 8pt;
      border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 1mm;
    }
    .t-item { padding: 1.2mm 0; border-bottom: 1px dotted #ccc; }
    .t-item:last-child { border-bottom: none; }
    .t-item-top { display: flex; justify-content: space-between; gap: 3mm; font-weight: 700; }
    .t-item-name { flex: 1; word-break: break-word; }
    .t-item-amt { flex-shrink: 0; white-space: nowrap; }
    .t-item-meta { font-size: 7.5pt; color: #333; margin-top: 0.3mm; }

    /* ── Totals ── */
    .totals { margin-top: ${isThermal ? '2mm' : '4mm'}; }
    .totals .row {
      display: flex; justify-content: space-between;
      padding: 0.7mm 0;
      font-size: ${isThermal ? '9pt' : '11pt'};
    }
    .totals .row.subtle { color: #444; }
    .totals .grand {
      margin-top: 1.5mm;
      padding: 1.5mm 0;
      border-top: ${isThermal ? '1px dashed #000' : '1.5px solid ' + primaryColor};
      border-bottom: ${isThermal ? '1px dashed #000' : '1.5px solid ' + primaryColor};
      display: flex; justify-content: space-between; align-items: baseline;
      font-weight: 800;
      font-size: ${amountFontSize};
      color: ${isThermal ? '#000' : primaryColor};
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      margin-top: ${isThermal ? '3mm' : '6mm'};
      padding-top: ${isThermal ? '2mm' : '4mm'};
      border-top: 1px ${isThermal ? 'dashed #000' : 'solid #ddd'};
      font-size: ${isThermal ? '8pt' : '9pt'};
      color: ${isThermal ? '#000' : '#888'};
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    ${logoHtml}
    <div class="store-name">${escapeHtml(store.store_name || 'Store')}</div>
    <div class="store-meta">
      ${store.address ? `${escapeHtml(store.address)}<br>` : ''}
      ${[store.phone ? `Ph: ${escapeHtml(store.phone)}` : '', escapeHtml(store.email || '')].filter(Boolean).join('  ·  ')}
      ${store.gst_tax_id ? `<br>GSTIN: ${escapeHtml(store.gst_tax_id)}` : ''}
    </div>
  </div>

  <div class="receipt-title">Tax Invoice</div>

  <!-- Meta -->
  <div class="meta-grid">
    <span class="lbl">Invoice #</span>
    <span class="val">${escapeHtml(sale.sale_number || '—')}</span>
    <span class="lbl">Date</span>
    <span class="val">${fmt(sale.date)}${sale.time ? ' ' + escapeHtml(sale.time) : ''}</span>
    <span class="lbl">Customer</span>
    <span class="val">${escapeHtml(ledgerName || sale.ledger_name || '—')}</span>
  </div>

  <hr class="divider" />

  ${itemsHtml}

  <!-- Totals -->
  <div class="totals">
    <div class="row subtle"><span>Items</span><span>${items.length} · ${totalQty} qty</span></div>
    ${totalItemDiscount > 0 ? `<div class="row subtle"><span>Item Discount</span><span>− ${money(totalItemDiscount)}</span></div>` : ''}
    ${totalBillDiscount > 0 ? `<div class="row subtle"><span>Bill Discount</span><span>− ${money(totalBillDiscount)}</span></div>` : ''}
    ${gstSlabRows}
    <div class="grand"><span>Total</span><span>${money(totalAmount)}</span></div>
  </div>

  ${sale.notes ? `<div style="margin-top:${isThermal ? '2mm' : '4mm'};font-size:${isThermal ? '8pt' : '9pt'};color:#555;">Notes: ${escapeHtml(sale.notes)}</div>` : ''}

  <!-- Footer -->
  <div class="footer">Thank you for your purchase!</div>

</div>
</body>
</html>`;

  return html;
}

export function printSaleReceipt(opts) {
  const html = buildSaleReceiptHtml(opts);
  const win = window.open('', '_blank', 'width=420,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
