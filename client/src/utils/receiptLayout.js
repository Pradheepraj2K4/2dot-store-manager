// Default receipt layout configuration
const RECEIPT_LAYOUT_KEY = 'inventory_receipt_layout';

export const DEFAULT_RECEIPT_LAYOUT = {
  elements: [
    { id: 'logo', type: 'logo', label: 'Shop Logo', enabled: true, order: 0 },
    { id: 'storeName', type: 'storeName', label: 'Store Name', enabled: true, order: 1 },
    { id: 'storeInfo', type: 'storeInfo', label: 'Store Address & Contact', enabled: true, order: 2 },
    { id: 'gst', type: 'gst', label: 'GST / Tax ID', enabled: true, order: 3 },
    { id: 'title', type: 'title', label: 'Receipt Title', enabled: true, order: 4 },
    { id: 'divider1', type: 'divider', label: 'Divider', enabled: true, order: 5 },
    { id: 'receiptNo', type: 'receiptNo', label: 'Receipt Number', enabled: true, order: 6 },
    { id: 'date', type: 'date', label: 'Date', enabled: true, order: 7 },
    { id: 'party', type: 'party', label: 'Party Name', enabled: true, order: 8 },
    { id: 'partyType', type: 'partyType', label: 'Party Type', enabled: true, order: 9 },
    { id: 'divider2', type: 'divider', label: 'Divider', enabled: true, order: 10 },
    { id: 'amount', type: 'amount', label: 'Amount', enabled: true, order: 11 },
    { id: 'txnType', type: 'txnType', label: 'Transaction Type Badge', enabled: true, order: 12 },
    { id: 'divider3', type: 'divider', label: 'Divider', enabled: true, order: 13 },
    { id: 'balanceAfter', type: 'balanceAfter', label: 'Balance After Transaction', enabled: true, order: 14 },
    { id: 'reference', type: 'reference', label: 'Reference / Notes', enabled: true, order: 15 },
    { id: 'divider4', type: 'divider', label: 'Divider', enabled: true, order: 16 },
    { id: 'footer', type: 'footer', label: 'Footer Message', enabled: true, order: 17 },
    { id: 'signature', type: 'signature', label: 'Signature Line', enabled: true, order: 18 },
  ],
  style: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    primaryColor: '#1D4ED8',
    format: 'a5',
    headerFontSize: 20,
    bodyFontSize: 12,
    footerFontSize: 10,
    titleText: 'PAYMENT RECEIPT',
    footerText: 'Thank you for your business!',
    showBorder: true,
  },
};

export function getReceiptLayout() {
  try {
    const saved = localStorage.getItem(RECEIPT_LAYOUT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new elements added in updates
      const defaultIds = DEFAULT_RECEIPT_LAYOUT.elements.map(e => e.id);
      const savedIds = parsed.elements.map(e => e.id);
      const missing = DEFAULT_RECEIPT_LAYOUT.elements.filter(e => !savedIds.includes(e.id));
      if (missing.length > 0) {
        const maxOrder = Math.max(...parsed.elements.map(e => e.order), 0);
        missing.forEach((el, i) => {
          parsed.elements.push({ ...el, order: maxOrder + i + 1 });
        });
      }
      return { ...DEFAULT_RECEIPT_LAYOUT, ...parsed, style: { ...DEFAULT_RECEIPT_LAYOUT.style, ...parsed.style } };
    }
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(DEFAULT_RECEIPT_LAYOUT));
}

export function saveReceiptLayout(layout) {
  localStorage.setItem(RECEIPT_LAYOUT_KEY, JSON.stringify(layout));
}
