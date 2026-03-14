/**
 * Interest Payment Receipt printer
 *
 * Generates a print-ready HTML page in a popup window.
 * Paper size is driven by `format`: 'a5' | 'a4' | 'thermal'
 */

function fmt(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function money(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n ?? 0);
}

const PAGE_SIZES = {
  a5:      { cssSize: 'A5',        width: '148mm' },
  a4:      { cssSize: 'A4',        width: '210mm' },
  thermal: { cssSize: '80mm auto', width: '76mm'  },
};

export function buildInterestReceiptHtml({ entry, ledgerName, store = {}, logoDataUrl = null, format = 'a5' }) {
  const ps = PAGE_SIZES[format] || PAGE_SIZES.a5;
  const isThermal = format === 'thermal';

  const period = entry.from_date === entry.to_date
    ? fmt(entry.from_date)
    : `${fmt(entry.from_date)} – ${fmt(entry.to_date)}`;

  const headerFontSize   = isThermal ? '13pt' : '18pt';
  const bodyFontSize     = isThermal ? '9pt'  : '11pt';
  const amountFontSize   = isThermal ? '14pt' : '18pt';
  const primaryColor     = '#1D4ED8';
  const logoHtml = logoDataUrl
    ? `<div class="logo-wrap"><img src="${logoDataUrl}" alt="Logo"/></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Interest Receipt ${entry.interest_number || ''}</title>
  <style>
    @page { size: ${ps.cssSize}; margin: ${isThermal ? '4mm 3mm' : '12mm'}; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: ${bodyFontSize};
      color: #1a1a1a;
      width: ${ps.width};
    }
    @media screen {
      html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
    }
    .page { width: 100%; padding: ${isThermal ? '2mm 4mm' : '4mm 14mm'}; }

    /* ── Logo ── */
    .logo-wrap { text-align: center; margin-bottom: ${isThermal ? '2mm' : '3mm'}; }
    .logo-wrap img { max-height: ${isThermal ? '12mm' : '20mm'}; max-width: 100%; object-fit: contain; }

    /* ── Header ── */
    .header {
      text-align: center;
      padding-bottom: ${isThermal ? '3mm' : '6mm'};
      margin-bottom: ${isThermal ? '3mm' : '5mm'};
      border-bottom: 2px solid ${primaryColor};
    }
    .store-name {
      font-size: ${headerFontSize};
      font-weight: 800;
      color: ${primaryColor};
      letter-spacing: 0.5px;
    }
    .store-meta {
      font-size: ${isThermal ? '8pt' : '9pt'};
      color: #555;
      margin-top: 1.5mm;
      line-height: 1.5;
    }

    /* ── Receipt title ── */
    .receipt-title {
      text-align: center;
      font-size: ${isThermal ? '10pt' : '11pt'};
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: ${isThermal ? '2mm 0' : '4mm 0 2mm'};
      color: #111;
    }

    /* ── Info rows ── */
    .section { margin: ${isThermal ? '2mm 0' : '3mm 0'}; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1mm 0;
      gap: 4mm;
    }
    .row .label { color: #666; flex-shrink: 0; }
    .row .value { font-weight: 600; text-align: right; }

    /* ── Divider ── */
    .divider { border: none; border-top: 1px dashed #bbb; margin: ${isThermal ? '2.5mm 0' : '4mm 0'}; }
    .divider-solid { border: none; border-top: 1px solid #ccc; margin: ${isThermal ? '2.5mm 0' : '4mm 0'}; }

    /* ── Number badge ── */
    .badge {
      display: inline-block;
      background: #dbeafe;
      color: ${primaryColor};
      padding: 0.5mm 2mm;
      border-radius: 3px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      font-size: ${isThermal ? '8.5pt' : '10pt'};
    }

    /* ── Amount box ── */
    .amount-box {
      border: 1.5px solid ${primaryColor};
      border-radius: 5px;
      padding: ${isThermal ? '2.5mm' : '4mm'};
      margin: ${isThermal ? '3mm 0' : '5mm 0'};
      text-align: center;
      background: #f0f4ff;
    }
    .amount-label { font-size: ${isThermal ? '8pt' : '9pt'}; color: #555; margin-bottom: 1mm; }
    .amount-value { font-size: ${amountFontSize}; font-weight: 800; color: ${primaryColor}; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      margin-top: ${isThermal ? '4mm' : '6mm'};
      padding-top: ${isThermal ? '2.5mm' : '4mm'};
      border-top: 1px solid #ddd;
      font-size: ${isThermal ? '8pt' : '9pt'};
      color: #888;
    }

    /* ── Signature ── */
    .signature {
      display: flex;
      justify-content: flex-end;
      margin-top: ${isThermal ? '5mm' : '8mm'};
    }
    .sig-inner { text-align: center; }
    .sig-line { border-top: 1px solid #444; width: ${isThermal ? '28mm' : '40mm'}; margin-bottom: 1mm; }
    .sig-text { font-size: ${isThermal ? '7.5pt' : '8.5pt'}; color: #666; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    ${logoHtml}
    <div class="store-name">${store.store_name || 'Store'}</div>
    <div class="store-meta">
      ${store.address ? `${store.address}<br>` : ''}
      ${[store.phone ? `Ph: ${store.phone}` : '', store.email || ''].filter(Boolean).join('  ·  ')}
      ${store.gst_tax_id ? `<br>GSTIN: ${store.gst_tax_id}` : ''}
    </div>
  </div>

  <!-- Title -->
  <div class="receipt-title">Interest Payment Receipt</div>

  <!-- Receipt meta -->
  <div class="section">
    <div class="row">
      <span class="label">Receipt No.</span>
      <span class="value"><span class="badge">${entry.interest_number || '—'}</span></span>
    </div>
    <div class="row">
      <span class="label">Date</span>
      <span class="value">${fmt(entry.paid_date)}</span>
    </div>
  </div>

  <hr class="divider" />

  <!-- Party & period -->
  <div class="section">
    <div class="row">
      <span class="label">Ledger / Party</span>
      <span class="value">${ledgerName || '—'}</span>
    </div>
    <div class="row">
      <span class="label">Interest Period</span>
      <span class="value">${period}</span>
    </div>
    <div class="row">
      <span class="label">Interest Rate</span>
      <span class="value">${entry.rate}%</span>
    </div>
    <div class="row">
      <span class="label">Principal Amount</span>
      <span class="value">${money(entry.principal_at_time)}</span>
    </div>
  </div>

  <hr class="divider" />

  <!-- Amount received -->
  <div class="amount-box">
    <div class="amount-label">Amount Received</div>
    <div class="amount-value">${money(entry.amount)}</div>
  </div>

  <!-- Footer -->
  <div class="footer">Thank you for your payment!</div>

  <!-- Signature -->
  <div class="signature">
    <div class="sig-inner">
      <div class="sig-line"></div>
      <div class="sig-text">Authorized Signature</div>
    </div>
  </div>

</div>
</body>
</html>`;

  return html;
}

export function printInterestReceipt(opts) {
  const html = buildInterestReceiptHtml(opts);
  const win = window.open('', '_blank', 'width=700,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function fetchLogoDataUrl(logoPath) {
  if (!logoPath) return Promise.resolve(null);
  // Add cache-buster so we never hit a stale 404 from a previous attempt
  const src = logoPath.includes('?') ? logoPath : `${logoPath}?_t=${Date.now()}`;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        // Canvas tainted or other error — fall back to the raw URL
        resolve(logoPath);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
