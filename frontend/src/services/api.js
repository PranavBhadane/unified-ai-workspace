const BASE_URL = '/api';

function generateRequestId() {
  return 'fe-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const requestId = options.requestId || generateRequestId();
  const timeoutMs = options.timeout || (endpoint.startsWith('/ai/chat') ? 60000 : 20000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers,
    credentials: 'include',
    signal: options.signal || controller.signal
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timer);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errObj = data.error || {};
      const errMsg = typeof errObj === 'string' ? errObj : (errObj.message || `HTTP ${response.status}: ${response.statusText}`);
      const err = new Error(errMsg);
      err.code = errObj.code || `HTTP_${response.status}`;
      err.status = response.status;
      err.requestId = data.requestId || errObj.requestId || requestId;
      err.details = errObj.details;
      throw err;
    }

    return data;
  } catch (fetchErr) {
    clearTimeout(timer);
    if (fetchErr.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutErr.code = 'REQUEST_TIMEOUT';
      timeoutErr.requestId = requestId;
      throw timeoutErr;
    }
    throw fetchErr;
  }
}

export const api = {
  // Auth
  getMe: () => request('/auth/me'),
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Dashboard & KPIs
  getKPIs: () => request('/dashboard/kpi'),
  getRecentActivity: () => request('/dashboard/recent-activity'),
  getDocuments: (params = '') => request(`/dashboard/documents${params}`),

  // Connections
  getConnections: () => request('/connections'),
  connectPlatform: (platform) => request(`/connections/${platform}/connect`, { method: 'POST' }),
  disconnectPlatform: (platform) => request(`/connections/${platform}`, { method: 'DELETE' }),

  // WhatsApp
  getWhatsAppQr: () => request('/whatsapp/qr'),
  getWhatsAppStatus: () => request('/whatsapp/status'),
  getWhatsAppLiveStatus: () => request('/whatsapp/live-status'),
  syncWhatsAppGroups: () => request('/sync/groups', { method: 'POST' }),
  getWhatsAppStats: () => request('/whatsapp/stats'),
  getWhatsAppAnalytics: (type = 'daily', tzOffset = 330) => request(`/whatsapp/analytics/${type}?tzOffset=${tzOffset}`),
  getWhatsAppChats: (q = '') => request(`/whatsapp/chats?q=${encodeURIComponent(q)}`),
  getWhatsAppMessages: (chatJid) => request(`/whatsapp/messages?chatJid=${encodeURIComponent(chatJid)}`),

  // Gmail
  getEmails: (q = '') => request(`/gmail/messages?q=${encodeURIComponent(q)}`),
  getEmailThreads: () => request('/gmail/threads'),

  // Drive
  getDriveFiles: (q = '') => request(`/drive/files?q=${encodeURIComponent(q)}`),
  getDriveFolders: () => request('/drive/folders'),

  // AI Assistant & Multi-Provider
  chat: (payload) => request('/ai/chat', { method: 'POST', body: JSON.stringify(payload), timeout: 70000 }),
  getConversations: () => request('/ai/conversations'),
  getConversation: (id) => request(`/ai/conversations/${id}`),
  createConversation: (payload) => request('/ai/conversations', { 
    method: 'POST', 
    body: JSON.stringify(typeof payload === 'string' ? { title: payload } : payload) 
  }),
  getModels: (provider = 'gemini') => request(`/ai/models?provider=${encodeURIComponent(provider)}`),
  getAiProviders: () => request('/ai/providers'),
  saveAiProvider: (payload) => request('/ai/providers', { method: 'POST', body: JSON.stringify(payload) }),
  removeAiProvider: (provider) => request(`/ai/providers/${provider}`, { method: 'DELETE' }),
  testAiProvider: (provider, model = null) => request(`/ai/providers/${provider}/test`, { method: 'POST', body: JSON.stringify({ model }) }),
  setDefaultAiProvider: (provider) => request('/ai/providers/default', { method: 'POST', body: JSON.stringify({ provider }) }),
  testGemini: (model) => request('/ai/providers/gemini/test', { method: 'POST', body: JSON.stringify({ model }) }),

  // Entities & Clients
  getEntities: (q = '') => request(`/entities?q=${encodeURIComponent(q)}`),
  getEntity: (id) => request(`/entities/${id}`),
  getEntityTimeline: (id) => request(`/entities/${id}/timeline`),
  triggerCorrelation: () => request('/entities/correlate', { method: 'POST' }),

  // Synchronization
  getSyncStatus: () => request('/sync/status'),
  getSyncHistory: () => request('/sync/history'),
  startSync: (platform) => request('/sync/start', { method: 'POST', body: JSON.stringify({ platform }) }),
  stopSync: (platform) => request('/sync/stop', { method: 'POST', body: JSON.stringify({ platform }) }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'POST', body: JSON.stringify(payload) }),

  // Documents Management & Previews
  getDocuments: (params = '') => request(`/documents${params}`),
  getDocumentStats: () => request('/documents/stats'),
  getDocumentPreview: (id, params = '') => request(`/documents/${id}/preview${params}`),
  getDocumentDownloadUrl: (id) => `/api/documents/${id}/download`,

  // AI-Powered Reports Engine
  generateReport: (payload) => request('/reports/generate', { method: 'POST', body: JSON.stringify(payload), timeout: 90000 }),
  getReports: (params = '') => request(`/reports${params}`),
  getReport: (id) => request(`/reports/${id}`),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),
  getReportDownloadUrl: (id) => `/api/reports/${id}/download`,

  // AI Dashboards & Visual Builder
  getDashboards: () => request('/dashboards'),
  getDashboard: (id = 'default') => request(`/dashboards/${id}`),
  generateAiDashboard: (payload) => request('/dashboards/generate-ai', { method: 'POST', body: JSON.stringify(payload), timeout: 70000 }),
  deleteDashboard: (id) => request(`/dashboards/${id}`, { method: 'DELETE' }),

  // Logs System
  getLogs: (params = '') => request(`/logs${params}`),
  clearLogs: () => request('/logs', { method: 'DELETE', body: JSON.stringify({ confirm: true }) }),
  exportLogsUrl: (format = 'json') => `/api/logs/export?format=${format}`
};

export default api;
