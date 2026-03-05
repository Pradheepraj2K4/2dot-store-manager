import { api } from './client';

export const ledgerApi = {
  getAll: (type) => api.get(`/ledgers${type ? `?type=${type}` : ''}`),
  getById: (id) => api.get(`/ledgers/${id}`),
  search: (query) => api.get(`/ledgers?search=${encodeURIComponent(query)}`),
  create: (data) => api.post('/ledgers', data),
  update: (id, data) => api.put(`/ledgers/${id}`, data),
  delete: (id) => api.delete(`/ledgers/${id}`),
  getCounts: () => api.get('/ledgers/counts'),
};

export const accountApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/accounts${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/accounts/${id}`),
  getByLedger: (ledgerId) => api.get(`/accounts/ledger/${ledgerId}`),
  create: (data) => api.post('/accounts', data),
  close: (id) => api.put(`/accounts/${id}/close`),
  delete: (id) => api.delete(`/accounts/${id}`),
  getOutstanding: () => api.get('/accounts/outstanding'),
  getPendingInterest: () => api.get('/accounts/pending-interest'),
  getCounts: () => api.get('/accounts/counts'),
};

export const paymentApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/payments${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/payments/${id}`),
  getByAccount: (accountId) => api.get(`/payments/account/${accountId}`),
  payInterest: (data) => api.post('/payments/interest', data),
  payPrincipal: (data) => api.post('/payments/principal', data),
  getSummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/payments/summary${qs ? `?${qs}` : ''}`);
  },
  getRecent: (limit = 10) => api.get(`/payments/recent?limit=${limit}`),
  getNextReceiptNumber: () => api.get('/payments/next-receipt'),
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
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard'),
};

export const interestApi = {
  isEnabled: () => api.get('/interest/enabled'),
  getByAccount: (accountId) => api.get(`/interest/account/${accountId}`),
  getPendingByAccount: (accountId) => api.get(`/interest/account/${accountId}/pending`),
  getTotalPending: (accountId) => api.get(`/interest/account/${accountId}/total`),
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/interest${qs ? `?${qs}` : ''}`);
  },
  generate: (data = {}) => api.post('/interest/generate', data),
};
