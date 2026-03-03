import { api } from './client';

export const partyApi = {
  getAll: (type) => api.get(`/parties${type ? `?type=${type}` : ''}`),
  getById: (id) => api.get(`/parties/${id}`),
  search: (query) => api.get(`/parties?search=${encodeURIComponent(query)}`),
  create: (data) => api.post('/parties', data),
  update: (id, data) => api.put(`/parties/${id}`, data),
  delete: (id) => api.delete(`/parties/${id}`),
  getCounts: () => api.get('/parties/counts'),
};

export const transactionApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/transactions${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/transactions/${id}`),
  getByParty: (partyId) => api.get(`/transactions/party/${partyId}`),
  getPartyBalance: (partyId) => api.get(`/transactions/party/${partyId}/balance`),
  getOutstanding: () => api.get('/transactions/outstanding'),
  getNextReceiptNumber: (type = 'credit') => api.get(`/transactions/next-receipt?type=${type}`),
  recordPayment: (data) => api.post('/transactions', data),
  updatePayment: (id, data) => api.put(`/transactions/${id}`, data),
  deletePayment: (id) => api.delete(`/transactions/${id}`),
  getStatement: (partyId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/transactions/party/${partyId}/statement${qs ? `?${qs}` : ''}`);
  },
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
