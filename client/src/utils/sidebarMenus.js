// Canonical list of sidebar menu names (groups and their children), including
// menus that only appear when optional modules are enabled. Used by the
// Developer Settings "Menu Names" tab to let the operator rename every menu,
// and by the Sidebar to apply those custom labels.
//
// The `name` values here MUST exactly match the `name` fields used in
// Sidebar.jsx's navigation definitions — they are the stable keys that map a
// menu to its custom label. Only the displayed text changes; routing and
// active-state logic keep using these canonical names.
export const SIDEBAR_MENU_GROUPS = [
  {
    section: 'General',
    items: ['Dashboard', 'Settings'],
  },
  {
    section: 'Master',
    items: ['Master', 'Ledgers', 'Customers', 'Items', 'Unit', 'Staffs', 'Waiters'],
  },
  {
    section: 'Service',
    items: ['Service', 'Service Entry', 'Pending Services', 'Closed Services'],
  },
  {
    section: 'Inventory Transactions',
    items: [
      'Inventory Transactions',
      'Billing',
      'Purchase Entry',
      'Estimation',
      'Sales Return Entry',
      'Purchase Return Entry',
    ],
  },
  {
    section: 'Inventory Reports',
    items: ['Inventory Reports', 'Sales Report', 'Purchase Report', 'Stock Report'],
  },
  {
    section: 'GST Reports',
    items: ['GST Reports', 'GSTR1', 'GSTR2'],
  },
  {
    section: 'Account Transaction',
    items: ['Account Transaction', 'Payment Entry', 'Receipt Entry', 'Expense Entry'],
  },
  {
    section: 'Accounts Reports',
    items: [
      'Accounts Reports',
      'Day Book',
      'Accounts Statement',
      'Outstanding Report',
      'Bill Profit Report',
      'Overall Report',
      'Expense Reports',
      'Food Sales Report',
    ],
  },
  {
    section: 'Interest',
    items: ['Pending Interest', 'Paid Interest'],
  },
];

// Settings key that stores the custom label overrides as a JSON object mapping
// canonical menu name -> custom label.
export const SIDEBAR_MENU_LABELS_KEY = 'sidebar_menu_labels';

// Returns the display label for a canonical menu name, falling back to the
// canonical name when no custom override exists.
export function menuLabel(labels, name) {
  const custom = labels && typeof labels === 'object' ? labels[name] : undefined;
  return typeof custom === 'string' && custom.trim() ? custom : name;
}
