import { api } from './client';

export const ledgerApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/ledgers${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/ledgers/${id}`),
  search: (query) => api.get(`/ledgers?search=${encodeURIComponent(query)}`),
  create: (data) => api.post('/ledgers', data),
  update: (id, data) => api.put(`/ledgers/${id}`, data),
  delete: (id) => api.delete(`/ledgers/${id}`),
  getCounts: () => api.get('/ledgers/counts'),
  getOutstanding: () => api.get('/ledgers/outstanding'),
  getOutstandingByType: (typeId) => api.get(`/ledgers/outstanding/type/${typeId}`),
  getPendingInterest: () => api.get('/ledgers/pending-interest'),
};

export const ledgerTypeApi = {
  getAll: () => api.get('/ledger-types'),
  getById: (id) => api.get(`/ledger-types/${id}`),
  create: (data) => api.post('/ledger-types', data),
  update: (id, data) => api.put(`/ledger-types/${id}`, data),
  delete: (id) => api.delete(`/ledger-types/${id}`),
};

export const transactionApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/transactions${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/transactions/${id}`),
  getByLedger: (ledgerId) => api.get(`/transactions/ledger/${ledgerId}`),
  create: (data) => api.post('/transactions', data),
  delete: (id) => api.delete(`/transactions/${id}`),
  getSummary: () => api.get('/transactions/summary'),
  getRecent: (limit = 10) => api.get(`/transactions/recent?limit=${limit}`),
  getNextRunningNumber: (entryType) => api.get(`/transactions/next-number?entryType=${entryType}`),
};

export const settingsApi = {
  getAll: () => api.get('/settings'),
  get: (key) => api.get(`/settings/${key}`),
  update: (key, value) => api.put(`/settings/${key}`, { value }),
  updateBatch: (entries) => api.put('/settings/batch', entries),
  getReceiptConfig: () => api.get('/settings/receipt-config'),
  getStoreProfile: () => api.get('/settings/store-profile'),
  uploadLogo: (base64) => api.post('/settings/logo', { logo: base64 }),
  deleteLogo: () => api.delete('/settings/logo'),
  getBackupStatus: () => api.get('/settings/backup/status'),
  backupNow: () => api.post('/settings/backup/now'),
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard'),
};

export const interestApi = {
  isEnabled: () => api.get('/interest/enabled'),
  getByLedger: (ledgerId) => api.get(`/interest/ledger/${ledgerId}`),
  getPendingByLedger: (ledgerId) => api.get(`/interest/ledger/${ledgerId}/pending`),
  getTotalPending: (ledgerId) => api.get(`/interest/ledger/${ledgerId}/total`),
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/interest${qs ? `?${qs}` : ''}`);
  },
  generate: (data = {}) => api.post('/interest/generate', data),
  markPaid: (id, paidDate, amount) => api.post(`/interest/${id}/pay`, { paidDate: paidDate || null, amount: amount ?? null }),
  bulkPay: (data) => api.post('/interest/bulk-pay', data),
  deleteEntry: (id) => api.delete(`/interest/${id}`),
};

export const reportApi = {
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/reports/transactions${qs ? `?${qs}` : ''}`);
  },
  getTransactionSummary: () => api.get('/reports/transactions/summary'),
};

export const expenseApi = {
  // Categories
  getCategories: () => api.get('/expenses/categories'),
  createCategory: (name) => api.post('/expenses/categories', { name }),
  updateCategory: (id, name) => api.put(`/expenses/categories/${id}`, { name }),
  deleteCategory: (id) => api.delete(`/expenses/categories/${id}`),

  // Expenses
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/expenses${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getSuggestions: (q) => api.get(`/expenses/suggestions?q=${encodeURIComponent(q)}`),
  getSummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/expenses/summary${qs ? `?${qs}` : ''}`);
  },
  isEnabled: () => api.get('/settings/expense_module_enabled'),
};
