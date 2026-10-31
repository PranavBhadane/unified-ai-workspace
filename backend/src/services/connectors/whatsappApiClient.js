import crypto from 'crypto';
import config from '../../config/env.js';
import logger from '../../utils/logger.js';
import { query } from '../../config/db.js';

class WhatsAppApiClient {
  constructor() {
    this.baseUrl = (config.whatsappApi?.baseUrl || process.env.WHATSAPP_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
    this.apiKey = config.whatsappApi?.apiKey || process.env.WHATSAPP_API_KEY || '';
    this.timeoutMs = config.whatsappApi?.timeoutMs || parseInt(process.env.WHATSAPP_API_TIMEOUT_MS || '8000', 10);
    this.lastHealth = {
      reachable: false,
      status: 'unreachable',
      lastChecked: null,
      error: null
    };
  }

  /**
   * Update configuration at runtime
   */
  configure({ baseUrl, apiKey, timeoutMs }) {
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (timeoutMs) this.timeoutMs = timeoutMs;
  }

  /**
   * Helper to perform an HTTP request against the WhatsApp API service
   */
  async request(path, options = {}) {
    const requestId = options.requestId || `wa-${crypto.randomUUID().substring(0, 8)}`;
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const method = (options.method || 'GET').toUpperCase();
    const t0 = Date.now();

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Request-Id': requestId,
      ...(options.headers || {})
    };

    // If API key configured, send both x-api-key and Authorization header
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);

      const durationMs = Date.now() - t0;
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => null);
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      // Log request & response safely without sensitive plain-text messages
      logger.info('whatsapp_api', `${method} ${path}`, `HTTP ${response.status} (${durationMs}ms)`, {
        requestId,
        status: response.status,
        durationMs,
        details: {
          url: this.sanitizeUrl(url),
          method,
          status: response.status,
          success: response.ok,
          itemCount: Array.isArray(data) ? data.length : (data?.data ? (Array.isArray(data.data) ? data.data.length : 1) : 1)
        }
      });

      if (!response.ok) {
        const errMsg = data?.error?.message || data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
        const err = new Error(errMsg);
        err.status = response.status;
        err.data = data;
        err.requestId = requestId;
        throw err;
      }

      this.lastHealth = {
        reachable: true,
        status: 'reachable',
        lastChecked: new Date().toISOString(),
        error: null
      };

      return data;
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - t0;
      const isAbort = err.name === 'AbortError';
      const isConnRefused = err.cause?.code === 'ECONNREFUSED' || err.code === 'ECONNREFUSED';
      const errorMessage = isAbort
        ? `Request timed out after ${this.timeoutMs}ms`
        : (isConnRefused ? `Connection refused at ${this.baseUrl} - service is offline` : err.message);

      this.lastHealth = {
        reachable: false,
        status: 'unreachable',
        lastChecked: new Date().toISOString(),
        error: errorMessage
      };

      logger.warn('whatsapp_api', `${method} ${path}`, `Failed: ${errorMessage} (${durationMs}ms)`, {
        requestId,
        durationMs,
        error: { message: errorMessage, code: err.cause?.code || err.code || (isAbort ? 'TIMEOUT' : 'FETCH_ERROR') }
      });

      err.durationMs = durationMs;
      err.isOffline = isConnRefused || isAbort;
      throw err;
    }
  }

  sanitizeUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.searchParams.has('key') || u.searchParams.has('token')) {
        u.searchParams.set('key', '[REDACTED]');
      }
      return u.toString();
    } catch {
      return rawUrl;
    }
  }

  // ==================== SYSTEM ENDPOINTS ====================

  /**
   * GET / - Lists available endpoints
   */
  async getRoot(requestId) {
    return this.request('/', { requestId });
  }

  /**
   * GET /api/health - Server uptime and health
   */
  async getHealth(requestId) {
    try {
      const res = await this.request('/api/health', { requestId });
      return {
        reachable: true,
        status: 'reachable',
        data: res
      };
    } catch (error) {
      return {
        reachable: false,
        status: 'unreachable',
        error: error.message
      };
    }
  }

  /**
   * GET /api/status - WhatsApp connection state and counts
   */
  async getStatus(requestId) {
    return this.request('/api/status', { requestId });
  }

  /**
   * GET /api/stats - Overall archive statistics
   */
  async getStats(requestId) {
    return this.request('/api/stats', { requestId });
  }

  /**
   * POST /api/sync/groups - Synchronize group names and participants
   */
  async syncGroups(requestId) {
    return this.request('/api/sync/groups', { method: 'POST', requestId });
  }

  // ==================== CHATS ENDPOINTS ====================

  /**
   * GET /api/chats - List chats (type, q, limit, offset)
   */
  async getChats({ type, q, limit = 50, offset = 0 } = {}, requestId) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/chats${qs}`, { requestId });
  }

  async getChat(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}`, { requestId });
  }

  async getChatMessages(chatId, queryParams = {}, requestId) {
    const params = new URLSearchParams(queryParams);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/messages${qs}`, { requestId });
  }

  async getChatStats(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/stats`, { requestId });
  }

  async getChatMedia(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/media`, { requestId });
  }

  async getChatLinks(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/links`, { requestId });
  }

  async getChatParticipants(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/participants`, { requestId });
  }

  async getChatTimeline(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/timeline`, { requestId });
  }

  async getChatTranscript(chatId, requestId) {
    return this.request(`/api/chats/${encodeURIComponent(chatId)}/transcript`, { requestId });
  }

  // ==================== MESSAGES ENDPOINTS ====================

  /**
   * GET /api/messages - Filter messages
   */
  async getMessages(filters = {}, requestId) {
    const params = new URLSearchParams();
    const allowed = ['chatId', 'sender', 'fromMe', 'isGroup', 'type', 'kind', 'hasText', 'from', 'to', 'q', 'order', 'limit', 'offset'];
    for (const key of allowed) {
      if (filters[key] !== undefined && filters[key] !== null) {
        if (key === 'limit') {
          params.set('limit', String(Math.min(500, parseInt(filters[key], 10) || 50)));
        } else {
          params.set(key, String(filters[key]));
        }
      }
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/messages${qs}`, { requestId });
  }

  async getMessage(id, requestId) {
    return this.request(`/api/messages/${encodeURIComponent(id)}`, { requestId });
  }

  async getMessageContext(id, requestId) {
    return this.request(`/api/messages/${encodeURIComponent(id)}/context`, { requestId });
  }

  async getMessageReplies(id, requestId) {
    return this.request(`/api/messages/${encodeURIComponent(id)}/replies`, { requestId });
  }

  // ==================== SEARCH ENDPOINTS ====================

  async search(q, requestId) {
    return this.request(`/api/search?q=${encodeURIComponent(q || '')}`, { requestId });
  }

  async searchAll(q, scope = 'all', requestId) {
    return this.request(`/api/search/all?q=${encodeURIComponent(q || '')}&scope=${encodeURIComponent(scope || 'all')}`, { requestId });
  }

  // ==================== CONTACTS ENDPOINTS ====================

  async getContacts(filters = {}, requestId) {
    const params = new URLSearchParams(filters);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/contacts${qs}`, { requestId });
  }

  async getContact(id, requestId) {
    return this.request(`/api/contacts/${encodeURIComponent(id)}`, { requestId });
  }

  async getContactMessages(id, requestId) {
    return this.request(`/api/contacts/${encodeURIComponent(id)}/messages`, { requestId });
  }

  async getContactStats(id, requestId) {
    return this.request(`/api/contacts/${encodeURIComponent(id)}/stats`, { requestId });
  }

  // ==================== GROUPS ENDPOINTS ====================

  async getGroups(filters = {}, requestId) {
    const params = new URLSearchParams(filters);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/groups${qs}`, { requestId });
  }

  async getGroup(id, requestId) {
    return this.request(`/api/groups/${encodeURIComponent(id)}`, { requestId });
  }

  async getGroupMessages(id, requestId) {
    return this.request(`/api/groups/${encodeURIComponent(id)}/messages`, { requestId });
  }

  async getGroupParticipants(id, requestId) {
    return this.request(`/api/groups/${encodeURIComponent(id)}/participants`, { requestId });
  }

  // ==================== MEDIA AND LINKS ====================

  async getMedia(filters = {}, requestId) {
    const params = new URLSearchParams(filters);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/media${qs}`, { requestId });
  }

  async getLinks(filters = {}, requestId) {
    const params = new URLSearchParams(filters);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/links${qs}`, { requestId });
  }

  // ==================== ANALYTICS ====================

  async getAnalytics(type = 'daily', tzOffset = 330, requestId) {
    return this.request(`/api/analytics/${type}?tzOffset=${encodeURIComponent(tzOffset)}`, { requestId });
  }

  // ==================== EXPORT ====================

  async exportMessages(format = 'json', requestId) {
    return this.request(`/api/export/messages?format=${encodeURIComponent(format)}`, { requestId });
  }

  // ==================== CONNECTOR & MCP ====================

  async connectorSearch({ query = '', scope = 'all', limit = 10, offset = 0 } = {}, requestId) {
    const params = new URLSearchParams({
      query,
      scope,
      limit: String(limit),
      offset: String(offset)
    });
    return this.request(`/api/connector/search?${params.toString()}`, { requestId });
  }

  async connectorFetch(id, requestId) {
    return this.request(`/api/connector/fetch/${encodeURIComponent(id)}`, { requestId });
  }

  async callMcp(body, requestId) {
    return this.request('/mcp', { method: 'POST', body, requestId });
  }

  // ==================== LOCAL FALLBACK RETRIEVAL ====================

  /**
   * Retrieve status, archive statistics, and sync metadata from local MySQL database
   * Used when WhatsApp API service is offline or unreachable
   */
  async getLocalStatusAndStats() {
    try {
      const [acc] = await query(
        `SELECT * FROM connected_accounts WHERE platform = 'whatsapp' ORDER BY id DESC LIMIT 1`
      );

      const [chatsCount] = await query(`SELECT COUNT(*) as cnt FROM wa_chats`);
      const [msgsCount] = await query(`SELECT COUNT(*) as cnt FROM wa_messages`);
      const [groupsCount] = await query(`SELECT COUNT(*) as cnt FROM wa_groups`);
      const [mediaCount] = await query(`SELECT COUNT(*) as cnt FROM wa_messages WHERE has_media = 1`);
      const [linksCount] = await query(`SELECT COUNT(*) as cnt FROM wa_messages WHERE text_content LIKE '%http%'`);
      const [participantsCount] = await query(`SELECT COUNT(*) as cnt FROM wa_contacts`);

      return {
        isFallback: true,
        serviceHealth: 'unreachable',
        serviceUrl: this.baseUrl,
        connectionState: acc?.status || 'disconnected',
        account: acc ? {
          name: acc.account_name,
          phone: acc.account_identifier,
          lastSyncAt: acc.last_sync_at
        } : null,
        stats: {
          totalChats: Number(chatsCount?.cnt || 0),
          totalMessages: Number(msgsCount?.cnt || 0),
          totalGroups: Number(groupsCount?.cnt || 0),
          totalMedia: Number(mediaCount?.cnt || 0),
          totalLinks: Number(linksCount?.cnt || 0),
          totalParticipants: Number(participantsCount?.cnt || 0)
        },
        lastSyncTime: acc?.last_sync_at || null
      };
    } catch (e) {
      logger.error('whatsapp_api', 'local_fallback_error', e.message);
      return {
        isFallback: true,
        serviceHealth: 'unreachable',
        serviceUrl: this.baseUrl,
        connectionState: 'error',
        stats: {
          totalChats: 0,
          totalMessages: 0,
          totalGroups: 0,
          totalMedia: 0,
          totalLinks: 0,
          totalParticipants: 0
        },
        lastSyncTime: null
      };
    }
  }

  /**
   * Consolidated live status: attempts to query remote API service,
   * cleanly falls back to local MySQL database if offline/unreachable.
   */
  async getLiveStatus() {
    try {
      const health = await this.getHealth();
      if (!health.reachable) {
        const fallback = await this.getLocalStatusAndStats();
        return {
          ...fallback,
          serviceHealth: 'unreachable',
          message: `WhatsApp API service at ${this.baseUrl} is unreachable. Displaying cached local workspace data.`
        };
      }

      // If service is reachable, fetch stats and status concurrently
      const [statusRes, statsRes] = await Promise.allSettled([
        this.getStatus(),
        this.getStats()
      ]);

      const statusData = statusRes.status === 'fulfilled' ? statusRes.value : {};
      const statsData = statsRes.status === 'fulfilled' ? statsRes.value : {};

      // If stats missing or failed, combine with local fallback
      const totalChats = statsData.totalChats ?? statsData.chats ?? statusData.totalChats ?? 0;
      const totalMessages = statsData.totalMessages ?? statsData.messages ?? statusData.totalMessages ?? 0;
      const totalGroups = statsData.totalGroups ?? statsData.groups ?? statusData.totalGroups ?? 0;
      const totalMedia = statsData.totalMedia ?? statsData.media ?? statusData.totalMedia ?? 0;
      const totalLinks = statsData.totalLinks ?? statsData.links ?? statusData.totalLinks ?? 0;
      const totalParticipants = statsData.totalParticipants ?? statsData.participants ?? statusData.totalParticipants ?? 0;

      return {
        isFallback: false,
        serviceHealth: 'reachable',
        serviceUrl: this.baseUrl,
        connectionState: statusData.status || statusData.state || 'connected',
        account: statusData.account || statusData.user || null,
        stats: {
          totalChats: Number(totalChats),
          totalMessages: Number(totalMessages),
          totalGroups: Number(totalGroups),
          totalMedia: Number(totalMedia),
          totalLinks: Number(totalLinks),
          totalParticipants: Number(totalParticipants)
        },
        lastSyncTime: statusData.lastSyncTime || statusData.last_sync || new Date().toISOString()
      };
    } catch {
      return this.getLocalStatusAndStats();
    }
  }
}

export const whatsappApiClient = new WhatsAppApiClient();
export default whatsappApiClient;
