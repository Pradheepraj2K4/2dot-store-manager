import { useRef, useMemo } from 'react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getReceiptLayout } from '../../utils/receiptLayout';
import { PrinterIcon } from '@heroicons/react/24/outline';

/**
 * Build the receipt HTML content using ONLY inline styles.
 * This same HTML is used in both preview (via dangerouslySetInnerHTML) and print window,
 * ensuring they always match exactly.
 */
function buildReceiptHTML({ transaction, storeProfile, layout, logoUrl }) {
  const s = layout.style;
  const isThermal = s.format === 'thermal';
  const isCredit = transaction.type === 'credit';

  // Ink-friendly monochrome palette
  const amountColor = '#111827';
  const balColor    = '#374151';

  const partyName   = transaction.party_name  || 'Party';
  const partyType   = transaction.party_type  || '';
  const storeName   = storeProfile.store_name || '2Dot Store Manager';
  const absAmount   = Math.abs(transaction.amount);
  const formattedAmount = '\u20B9' + absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balAfter    = transaction.balance_after;
  const formattedBalance = formatCurrency(balAfter);
  const dateStr     = formatDate(transaction.date);

  // ── Thermal fallback (narrow layout unchanged) ────────────────────────
  if (isThermal) {
    const elements = [...layout.elements].sort((a, b) => a.order - b.order).filter((e) => e.enabled);
    const parts = elements.map((el) => {
      switch (el.type) {
        case 'logo':
          if (!logoUrl) return '';
          return `<div style="text-align:center;margin-bottom:6px;"><img src="${logoUrl}" alt="Logo" style="max-height:40px;max-width:120px;object-fit:contain;" /></div>`;
        case 'storeName':
          return `<div style="text-align:center;font-size:15px;font-weight:700;color:#111827;">${storeName}</div>`;
        case 'storeInfo': {
          let lines = '';
          if (storeProfile.address) lines += `<div style="font-size:9px;color:#64748b;">${storeProfile.address}</div>`;
          if (storeProfile.phone)   lines += `<div style="font-size:9px;color:#64748b;">Tel: ${storeProfile.phone}</div>`;
          return lines ? `<div style="text-align:center;margin-top:2px;">${lines}</div>` : '';
        }
        case 'gst':
          return storeProfile.gst_tax_id ? `<div style="text-align:center;font-size:9px;color:#64748b;">GSTIN: ${storeProfile.gst_tax_id}</div>` : '';
        case 'divider':
          return `<div style="border-top:1px dashed #cbd5e1;margin:7px 0;"></div>`;
        case 'receiptNo':
          return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#64748b;">Receipt No</span><span style="font-weight:600;font-family:monospace;">${transaction.receipt_number}</span></div>`;
        case 'date':
          return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#64748b;">Date</span><span>${dateStr}</span></div>`;
        case 'party':
          return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#64748b;">${isCredit ? 'Received From' : 'Paid To'}</span><span style="font-weight:600;">${partyName}</span></div>`;
        case 'amount':
          return `<div style="text-align:center;padding:12px 0 6px;"><div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${isCredit ? 'Amount Received' : 'Amount Paid'}</div><div style="font-size:22px;font-weight:800;color:#111827;">${formattedAmount}</div></div>`;
        case 'balanceAfter':
          return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;"><span style="color:#6b7280;">Balance</span><span style="font-weight:700;color:#111827;">${formattedBalance}</span></div>`;
        case 'reference': {
          if (!transaction.reference && !transaction.notes) return '';
          let html = `<div style="background:#f8fafc;border-radius:4px;padding:6px 8px;font-size:10px;color:#64748b;">`;
          if (transaction.reference) html += `<div><b>Ref:</b> ${transaction.reference}</div>`;
          if (transaction.notes)     html += `<div><b>Notes:</b> ${transaction.notes}</div>`;
          return html + '</div>';
        }
        case 'footer':
          return `<div style="text-align:center;padding:6px 0 2px;font-size:9px;color:#94a3b8;">${s.footerText || 'Thank you for your business!'}</div>`;
        case 'signature':
          return `<div style="margin-top:18px;display:flex;justify-content:flex-end;"><div style="text-align:center;"><div style="border-top:1px solid #cbd5e1;width:100px;margin-bottom:3px;"></div><div style="font-size:9px;color:#94a3b8;">Authorized Signature</div></div></div>`;
        default:
          return '';
      }
    });
    return `<div style="max-width:320px;margin:0 auto;font-family:${s.fontFamily};color:#1e293b;background:#fff;padding:14px;line-height:1.5;">${parts.join('')}</div>`;
  }

  // ── A5 / A4 professional layout ─────────────────────────────────────────────────

  // Info row helper
  const row = (label, value, bold = false) =>
    `<tr>
      <td style="padding:5px 0 5px 0;color:#374151;font-size:12px;width:42%;vertical-align:top;">${label}</td>
      <td style="padding:5px 0;color:#0f172a;font-size:12px;font-weight:${bold ? 600 : 400};text-align:right;vertical-align:top;">${value}</td>
    </tr>`;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height:52px;max-width:130px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : '';

  // Address lines
  const addrLines = [
    storeProfile.address,
    storeProfile.phone ? `Tel: ${storeProfile.phone}` : '',
    storeProfile.email || '',
    storeProfile.gst_tax_id ? `GSTIN: ${storeProfile.gst_tax_id}` : '',
  ].filter(Boolean).map(l => `<div style="font-size:11px;color:#4b5563;line-height:1.45;">${l}</div>`).join('');

  // Receipt meta box (top-right) — light, ink-friendly
  const metaBox = `
    <table style="border-collapse:collapse;width:170px;border:1px solid #d1d5db;">
      <tr>
        <td colspan="2" style="background:#f3f4f6;padding:5px 10px;">
          <div style="font-size:10px;letter-spacing:1.5px;color:#374151;text-transform:uppercase;">${s.titleText || 'PAYMENT RECEIPT'}</div>
        </td>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:4px 10px;font-size:10px;color:#374151;">No.</td>
        <td style="padding:4px 10px;font-size:11px;font-weight:700;color:#111827;font-family:monospace;text-align:right;">${transaction.receipt_number}</td>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:4px 10px 6px;font-size:10px;color:#374151;">Date</td>
        <td style="padding:4px 10px 6px;font-size:11px;color:#111827;text-align:right;">${dateStr}</td>
      </tr>
    </table>`;

  // Amount band — neutral, no color tints
  const amountBandBg = '#f9fafb';
  const amountBandBorder = '#e5e7eb';

  // Balance label
  const balLabel = balAfter >= 0 ? 'Balance (Dr.)' : 'Balance (Cr.)';

  return `
<div style="
  width: 100%;
  max-width: 520px;
  min-height: ${isThermal ? 'auto' : '700px'};
  margin: 0 auto;
  font-family: ${s.fontFamily};
  color: #1e293b;
  background: #fff;
  overflow: hidden;
  line-height: 1.5;
">

  <!-- ═══ HEADER ═══ -->
  <div style="background:#fff;border-top:3px solid #374151;padding:20px 28px 16px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e5e7eb;">
    <div style="flex:1;">
      ${logoHtml}
      <div style="font-size:${s.headerFontSize}px;font-weight:800;color:#111827;letter-spacing:0.3px;line-height:1.2;">${storeName}</div>
      <div style="margin-top:4px;">${addrLines}</div>
    </div>
    <div style="flex-shrink:0;margin-left:20px;">
      ${metaBox}
    </div>
  </div>

  <!-- ═══ PARTY SECTION ═══ -->
  <div style="padding:18px 28px 0;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#4b5563;margin-bottom:4px;">
      ${isCredit ? 'Received From' : 'Paid To'}
    </div>
    <div style="font-size:17px;font-weight:700;color:#0f172a;">${partyName}</div>
    ${partyType ? `<div style="font-size:11px;color:#374151;margin-top:1px;text-transform:capitalize;">${partyType}</div>` : ''}
  </div>

  <!-- divider -->
  <div style="margin:16px 28px 0;border-top:1px solid #e2e8f0;"></div>

  <!-- ═══ AMOUNT BAND ═══ -->
  <div style="
    margin:16px 28px;
    background:${amountBandBg};
    border:1px solid ${amountBandBorder};
    border-radius:8px;
    padding:16px 22px;
    display:flex;
    align-items:center;
    justify-content:space-between;
  ">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#4b5563;margin-bottom:3px;">
        ${isCredit ? 'Amount Received' : 'Amount Paid'}
      </div>
      <div style="font-size:30px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${formattedAmount}</div>
    </div>
    <div style="
      background:#ffffff;
      color:#374151;
      font-size:11px;
      font-weight:600;
      letter-spacing:1px;
      padding:5px 14px;
      border-radius:4px;
      border:1px solid #d1d5db;
      text-transform:uppercase;
    ">${transaction.type === 'credit' ? 'Credit' : 'Debit'}</div>
  </div>

  <!-- ═══ DETAILS TABLE ═══ -->
  <div style="padding:0 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${row('Balance After', `<span style="font-weight:700;color:#111827">${formattedBalance}</span>`)}
        ${transaction.reference ? row('Reference', transaction.reference) : ''}
        ${transaction.notes     ? row('Notes',     transaction.notes)      : ''}
      </tbody>
    </table>
  </div>

  <!-- divider -->
  <div style="margin:14px 28px 0;border-top:1px dashed #e2e8f0;"></div>

  <!-- ═══ FOOTER / SIGNATURE ═══ -->
  <div style="padding:14px 28px 22px;display:flex;align-items:flex-end;justify-content:space-between;">
    <div style="font-size:11px;color:#374151;max-width:55%;line-height:1.5;">${s.footerText || 'Thank you for your business!'}</div>
    <div style="text-align:center;">
      <div style="border-top:1.5px solid #1f2937;width:140px;margin-bottom:5px;"></div>
      <div style="font-size:10px;color:#374151;letter-spacing:0.5px;">Authorized Signature</div>
    </div>
  </div>

</div>`;
}

export default function ReceiptPreview({ transaction, storeProfile, receiptConfig }) {
  const receiptRef = useRef(null);
  const layout = useMemo(() => getReceiptLayout(), []);
  const isThermal = layout.style.format === 'thermal';

  // Logo URL
  const logoUrl = storeProfile?.logo_path ? `/api/settings/logo-file?t=${Date.now()}` : null;

  const receiptHTML = useMemo(
    () => buildReceiptHTML({ transaction, storeProfile: storeProfile || {}, layout, logoUrl }),
    [transaction, storeProfile, layout, logoUrl]
  );

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${transaction.receipt_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 100%; height: 100%; }
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: ${isThermal ? '80mm auto' : 'A5'};
              margin: ${isThermal ? '4mm' : '10mm 12mm'};
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  };

  return (
    <div>
      {/* Print button */}
      <div className="flex justify-end mb-3">
        <button onClick={handlePrint} className="btn-primary gap-2">
          <PrinterIcon className="h-4 w-4" />
          Print Receipt
        </button>
      </div>

      {/* Page viewer — gray background, receipt centered with flex */}
      <div className="bg-slate-200 -mx-6 -mb-6 rounded-b-2xl py-8 px-4 flex justify-center">
        <div
          ref={receiptRef}
          className="shadow-xl"
          style={{ width: isThermal ? '320px' : '520px' }}
          dangerouslySetInnerHTML={{ __html: receiptHTML }}
        />
      </div>
    </div>
  );
}
