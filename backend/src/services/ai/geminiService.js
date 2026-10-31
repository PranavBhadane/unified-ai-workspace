import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { GoogleGenAI } from '@google/genai';
import config from '../../config/env.js';
import { query } from '../../config/db.js';
import searchEngine from '../search/searchEngine.js';
import entityResolver from '../entities/entityResolver.js';
import whatsappApiClient from '../connectors/whatsappApiClient.js';
import logger from '../../utils/logger.js';

class GeminiService {
  constructor() {
    this.apiKey = (config.gemini.apiKey || '').trim();
    this.modelName = config.gemini.model || 'gemini-3.1-flash-lite';
    this.ai = null;
    this.initClient();
  }

  initClient() {
    if (this.apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        logger.info('ai', 'gemini_init', `GoogleGenAI client initialized with model ${this.modelName}`);
      } catch (e) {
        logger.error('ai', 'gemini_init_failed', e.message, { error: e });
        this.ai = null;
      }
    } else {
      this.ai = null;
    }
  }

  updateConfig({ apiKey, model }) {
    if (apiKey !== undefined) this.apiKey = apiKey.trim();
    if (model !== undefined) this.modelName = model.trim();
    this.initClient();
  }

  /**
   * Load persisted settings from MySQL app_settings table on startup
   */
  async loadPersistedSettings() {
    try {
      const rows = await query(
        `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('gemini_model', 'gemini_api_key')`
      );
      rows.forEach(r => {
        if (r.setting_key === 'gemini_model' && r.setting_value) {
          this.modelName = r.setting_value.trim();
          config.gemini.model = this.modelName;
        }
        if (r.setting_key === 'gemini_api_key' && r.setting_value) {
          this.apiKey = r.setting_value.trim();
          config.gemini.apiKey = this.apiKey;
        }
      });
      this.initClient();
      logger.info('ai', 'gemini_settings_loaded', `Active model initialized from DB: ${this.modelName}`);
    } catch (err) {
      logger.warn('ai', 'gemini_settings_load_error', err.message);
    }
  }

  /**
   * Dedicated live connection test that calls the Gemini API
   */
  async testConnection(targetModel = null) {
    const modelToTest = targetModel || this.modelName;
    if (!this.apiKey) {
      return {
        success: false,
        error: 'No Gemini API key is configured. Please provide your Gemini API key in Settings or backend/.env.'
      };
    }

    const t0 = Date.now();
    try {
      this.initClient();
      logger.info('ai', 'gemini_test_start', `Testing connection with model: ${modelToTest}`);

      let replyText = 'OK';
      try {
        const response = await this.ai.models.generateContent({
          model: modelToTest,
          contents: 'Respond with "OK"'
        });
        replyText = response.text?.trim() || 'OK';
      } catch (sdkErr) {
        // Fallback to direct REST call if SDK method threw
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTest}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with "OK"' }] }] }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
        }
        replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      }

      const durationMs = Date.now() - t0;
      logger.info('ai', 'gemini_test_success', `Connection successful in ${durationMs}ms`, { durationMs, model: modelToTest });
      return {
        success: true,
        model: modelToTest,
        durationMs,
        reply: replyText
      };
    } catch (error) {
      const durationMs = Date.now() - t0;
      const isTimeout = error.name === 'AbortError';
      const msg = isTimeout ? `Connection test timed out after 12s` : error.message;
      logger.error('ai', 'gemini_test_error', msg, { durationMs, error });
      return {
        success: false,
        model: modelToTest,
        durationMs,
        error: msg
      };
    }
  }

  /**
   * List models available to the configured API key that support content generation
   */
  async listAvailableModels() {
    if (!this.apiKey) {
      return {
        success: false,
        models: this.getFallbackModels(),
        error: 'No Gemini API key configured. Showing standard model catalog.'
      };
    }

    try {
      logger.info('ai', 'gemini_list_models_start', 'Querying available Gemini models from Google API...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawModels = data.models || [];

      // Filter: only models supporting generateContent, excluding embeddings, audio-only, or experimental tts
      const supported = rawModels
        .filter(m => {
          const methods = m.supportedGenerationMethods || [];
          const name = (m.name || '').toLowerCase();
          return methods.includes('generateContent') &&
            !name.includes('embedding') &&
            !name.includes('tts') &&
            !name.includes('image-preview') &&
            !name.includes('imagen');
        })
        .map(m => {
          const id = m.name.replace(/^models\//, '');
          return {
            id,
            name: m.displayName || id,
            displayName: m.displayName || id,
            description: m.description || '',
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit
          };
        });

      logger.info('ai', 'gemini_list_models_success', `Discovered ${supported.length} generation models from API`);
      return {
        success: true,
        models: supported,
        currentModel: this.modelName
      };
    } catch (err) {
      logger.warn('ai', 'gemini_list_models_failed', `Failed to list models via API: ${err.message}. Using fallback catalog.`);
      return {
        success: false,
        models: this.getFallbackModels(),
        currentModel: this.modelName,
        warning: `Could not retrieve live models (${err.message}). Showing maintained model list.`
      };
    }
  }

  getFallbackModels() {
    return [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', displayName: 'Gemini 3 Flash Preview', description: 'Fast, high availability, multimodal & tools' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', displayName: 'Gemini 3.1 Flash-Lite', description: 'Ultra lightweight, low latency' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', displayName: 'Gemini 3.8 Flash', description: 'High speed, multimodal, function calling' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', displayName: 'Gemini 3.7 Flash', description: 'Next-gen multimodal reasoning model' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', displayName: 'Gemini 3.5 Flash', description: 'Fast responsive reasoning' }
    ];
  }

  getToolDeclarations() {
    return [
      {
        name: 'search_whatsapp_messages',
        description: 'Search WhatsApp messages by keyword, contact name, or phrase.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Search term or phrase' },
            limit: { type: 'INTEGER', description: 'Maximum number of results (default 10)' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_whatsapp_contacts',
        description: 'Search WhatsApp contacts and phone numbers.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Contact name or phone number' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_whatsapp_groups',
        description: 'Search WhatsApp groups and descriptions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Group subject or keyword' }
          },
          required: ['q']
        }
      },
      {
        name: 'get_whatsapp_message_context',
        description: 'Retrieve contextual conversation messages immediately before and after a specific WhatsApp message ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            messageId: { type: 'STRING', description: 'WhatsApp message unique ID' }
          },
          required: ['messageId']
        }
      },
      {
        name: 'get_whatsapp_chat_transcript',
        description: 'Retrieve the complete chat history or transcript of a specific WhatsApp conversation.',
        parameters: {
          type: 'OBJECT',
          properties: {
            chatId: { type: 'STRING', description: 'WhatsApp chat JID or ID' },
            limit: { type: 'INTEGER', description: 'Number of messages to retrieve (default 50)' }
          },
          required: ['chatId']
        }
      },
      {
        name: 'whatsapp_mcp_query',
        description: 'Perform deep contextual retrieval or execute an MCP tool on WhatsApp data for commitments, agreements, or payments.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term or question to evaluate' },
            action: { type: 'STRING', description: 'Action type (e.g. search, summarize, analyze)' }
          },
          required: ['query']
        }
      },
      {
        name: 'search_gmail_messages',
        description: 'Search Gmail emails by subject, body content, sender, or recipient.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Search keyword, sender email, or subject line' },
            limit: { type: 'INTEGER', description: 'Maximum number of results (default 10)' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_gmail_threads',
        description: 'Retrieve all messages in a specific Gmail thread.',
        parameters: {
          type: 'OBJECT',
          properties: {
            threadId: { type: 'STRING', description: 'Gmail thread ID' }
          },
          required: ['threadId']
        }
      },
      {
        name: 'search_drive_files',
        description: 'Search Google Drive files by filename, owner, or folder.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'File name or keyword' },
            limit: { type: 'INTEGER', description: 'Maximum results' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_drive_content',
        description: 'Search extracted text content inside Google Drive documents, spreadsheets, and PDFs.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Content search phrase' },
            limit: { type: 'INTEGER', description: 'Maximum results' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_all_sources',
        description: 'Search across WhatsApp, Gmail, Google Drive, and indexed document chunks simultaneously.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Universal search query' },
            platforms: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of platforms to search: ["whatsapp", "gmail", "drive"]'
            },
            limit: { type: 'INTEGER', description: 'Max items per source' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_contacts',
        description: 'Search unified contacts across all platforms.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Name, email, or phone number' }
          },
          required: ['q']
        }
      },
      {
        name: 'search_entities',
        description: 'Search client and company entities with cross-platform links.',
        parameters: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING', description: 'Client name, company name, or alias' }
          },
          required: ['q']
        }
      },
      {
        name: 'get_client_profile',
        description: 'Retrieve consolidated client dossier including WhatsApp chats, emails, Drive files, and financial highlights.',
        parameters: {
          type: 'OBJECT',
          properties: {
            clientNameOrId: { type: 'STRING', description: 'Client name, company, or entity ID' }
          },
          required: ['clientNameOrId']
        }
      },
      {
        name: 'get_client_timeline',
        description: 'Retrieve a unified chronological timeline of all interactions across WhatsApp, Gmail, and Drive for a client.',
        parameters: {
          type: 'OBJECT',
          properties: {
            clientNameOrId: { type: 'STRING', description: 'Client name or entity ID' }
          },
          required: ['clientNameOrId']
        }
      },
      {
        name: 'get_document_details',
        description: 'Retrieve metadata and extracted text chunks of a specific document or attachment.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fileId: { type: 'STRING', description: 'File ID or record ID' }
          },
          required: ['fileId']
        }
      },
      {
        name: 'get_conversation_summary',
        description: 'Retrieve recent messages and context of a specific WhatsApp chat conversation.',
        parameters: {
          type: 'OBJECT',
          properties: {
            chatJid: { type: 'STRING', description: 'Chat JID or phone identifier' }
          },
          required: ['chatJid']
        }
      },
      {
        name: 'get_transaction_history',
        description: 'Find discussed or confirmed transactions, payments, quotes, and invoices for an entity.',
        parameters: {
          type: 'OBJECT',
          properties: {
            entityName: { type: 'STRING', description: 'Client or vendor name' }
          },
          required: ['entityName']
        }
      },
      {
        name: 'find_payment_references',
        description: 'Scan across emails, WhatsApp, and Drive for payment mentions, invoices, rental amounts, and bank references.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Specific payment or invoice query' }
          }
        }
      },
      {
        name: 'find_pending_commitments',
        description: 'Scan for promised actions, deliverables, deadlines, and pending tasks in conversations.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Optional context query' }
          }
        }
      },
      {
        name: 'generate_client_report',
        description: 'Generate a structured client dossier containing overview, contact details, communications, agreements, transactions, commitments, and sources.',
        parameters: {
          type: 'OBJECT',
          properties: {
            clientName: { type: 'STRING', description: 'Target client name' },
            sections: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Sections to include'
            }
          },
          required: ['clientName']
        }
      }
    ];
  }

  /**
   * Execute a tool called by Gemini
   */
  async executeTool(name, args, onProgress = null, requestId = null) {
    logger.info('ai', 'tool_execution_start', `Tool requested: ${name}`, { requestId, details: { name, args } });

    if (onProgress) {
      onProgress({ stage: 'executing_tools', tool: name, args, text: `Executing ${name}...` });
    }

    try {
      let result;
      switch (name) {
        case 'search_whatsapp_messages': {
          try {
            const apiRes = await whatsappApiClient.connectorSearch(
              { query: args.q, scope: 'whatsapp', limit: args.limit || 10 },
              requestId
            );
            if (apiRes && (apiRes.results || apiRes.data || Array.isArray(apiRes))) {
              result = apiRes.results || apiRes.data || apiRes;
              break;
            }
          } catch (e) {
            logger.warn('ai', 'whatsapp_api_search_fallback', `WhatsApp API unavailable (${e.message}), falling back to local DB`);
          }
          result = await searchEngine.searchWhatsApp({ q: args.q, limit: args.limit || 10 });
          break;
        }

        case 'search_whatsapp_contacts': {
          try {
            const apiRes = await whatsappApiClient.getContacts({ q: args.q }, requestId);
            if (apiRes && (apiRes.contacts || apiRes.data || Array.isArray(apiRes))) {
              result = apiRes.contacts || apiRes.data || apiRes;
              break;
            }
          } catch (e) {
            logger.warn('ai', 'whatsapp_api_contacts_fallback', `WhatsApp API unavailable (${e.message}), falling back to local DB`);
          }
          result = await query(
            `SELECT * FROM wa_contacts WHERE name LIKE ? OR phone_number LIKE ? LIMIT 10`,
            [`%${args.q}%`, `%${args.q}%`]
          );
          break;
        }

        case 'search_whatsapp_groups': {
          try {
            const apiRes = await whatsappApiClient.getGroups({ q: args.q }, requestId);
            if (apiRes && (apiRes.groups || apiRes.data || Array.isArray(apiRes))) {
              result = apiRes.groups || apiRes.data || apiRes;
              break;
            }
          } catch (e) {
            logger.warn('ai', 'whatsapp_api_groups_fallback', `WhatsApp API unavailable (${e.message}), falling back to local DB`);
          }
          result = await query(
            `SELECT * FROM wa_groups WHERE subject LIKE ? OR description LIKE ? LIMIT 10`,
            [`%${args.q}%`, `%${args.q}%`]
          );
          break;
        }

        case 'get_whatsapp_message_context': {
          try {
            const apiRes = await whatsappApiClient.getMessageContext(args.messageId, requestId);
            if (apiRes) {
              result = apiRes;
              break;
            }
          } catch (e) {
            logger.warn('ai', 'whatsapp_api_context_fallback', `WhatsApp API unavailable (${e.message}), falling back to local DB`);
          }
          const [target] = await query(`SELECT * FROM wa_messages WHERE message_id = ? OR id = ?`, [args.messageId, args.messageId]);
          if (target) {
            const before = await query(`SELECT * FROM wa_messages WHERE chat_jid = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 3`, [target.chat_jid, target.timestamp]);
            const after = await query(`SELECT * FROM wa_messages WHERE chat_jid = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT 3`, [target.chat_jid, target.timestamp]);
            result = { target, before: before.reverse(), after };
          } else {
            result = { error: 'Message not found' };
          }
          break;
        }

        case 'get_whatsapp_chat_transcript': {
          try {
            const apiRes = await whatsappApiClient.getChatTranscript(args.chatId, requestId);
            if (apiRes) {
              result = apiRes;
              break;
            }
          } catch (e) {
            logger.warn('ai', 'whatsapp_api_transcript_fallback', `WhatsApp API unavailable (${e.message}), falling back to local DB`);
          }
          result = await query(
            `SELECT sender_name, timestamp, text_content, message_type FROM wa_messages WHERE chat_jid = ? ORDER BY timestamp ASC LIMIT ?`,
            [args.chatId, args.limit || 50]
          );
          break;
        }

        case 'whatsapp_mcp_query': {
          try {
            const apiRes = await whatsappApiClient.callMcp({ query: args.query, action: args.action || 'search' }, requestId);
            if (apiRes) {
              result = apiRes;
              break;
            }
          } catch (e) {
            logger.warn('ai', 'whatsapp_api_mcp_fallback', `WhatsApp MCP API unavailable (${e.message}), falling back to local search`);
          }
          result = await searchEngine.searchWhatsApp({ q: args.query, limit: 10 });
          break;
        }

        case 'search_gmail_messages':
          result = await searchEngine.searchGmail({ q: args.q, limit: args.limit || 10 });
          break;

        case 'search_gmail_threads': {
          result = await query(
            `SELECT id, sender_name, sender_email, subject, snippet, body_plain, internal_date 
             FROM emails WHERE thread_id = ? ORDER BY internal_date ASC`,
            [args.threadId]
          );
          break;
        }

        case 'search_drive_files':
          result = await searchEngine.searchDrive({ q: args.q, limit: args.limit || 10 });
          break;

        case 'search_drive_content':
          result = await searchEngine.searchDrive({ q: args.q, limit: args.limit || 10 });
          break;

        case 'search_all_sources':
          result = await searchEngine.searchAllSources({
            q: args.q,
            platforms: args.platforms || ['whatsapp', 'gmail', 'drive'],
            limit: args.limit || 15
          });
          break;

        case 'search_contacts': {
          result = await query(
            `SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ? LIMIT 10`,
            [`%${args.q}%`, `%${args.q}%`, `%${args.q}%`]
          );
          break;
        }

        case 'search_entities':
          result = await entityResolver.searchEntities(args.q, 10);
          break;

        case 'get_client_profile':
          result = await entityResolver.getClientProfile(args.clientNameOrId);
          break;

        case 'get_client_timeline':
          result = await entityResolver.getClientTimeline(args.clientNameOrId);
          break;

        case 'get_document_details': {
          const [file] = await query(`SELECT * FROM drive_files WHERE file_id = ? OR id = ?`, [args.fileId, args.fileId]);
          const chunks = await query(`SELECT * FROM document_chunks WHERE file_id = ? ORDER BY chunk_index ASC LIMIT 10`, [args.fileId]);
          result = { file, chunks };
          break;
        }

        case 'get_conversation_summary': {
          try {
            const apiRes = await whatsappApiClient.getChatTranscript(args.chatJid, requestId);
            if (apiRes) {
              result = apiRes;
              break;
            }
          } catch {
            // Fall through to database
          }
          result = await query(
            `SELECT sender_name, timestamp, text_content, caption, message_type
             FROM wa_messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT 20`,
            [args.chatJid]
          );
          break;
        }

        case 'get_transaction_history':
        case 'find_payment_references':
          result = await entityResolver.findPaymentReferences(args.query || args.entityName || '');
          break;

        case 'find_pending_commitments':
          result = await entityResolver.findPendingCommitments(args.query || '');
          break;

        case 'generate_client_report': {
          const profile = await entityResolver.getClientProfile(args.clientName);
          const timeline = await entityResolver.getClientTimeline(args.clientName);
          result = { profile, timeline };
          break;
        }

        default:
          result = { error: `Tool ${name} not recognized` };
      }

      logger.info('ai', 'tool_execution_complete', `Completed tool: ${name}`, {
        requestId,
        details: { resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0) }
      });
      return result;
    } catch (err) {
      logger.error('ai', 'tool_execution_error', `Error executing ${name}: ${err.message}`, {
        requestId,
        error: err
      });
      return { error: `Failed to execute ${name}: ${err.message}` };
    }
  }

  async callModelWithFailover({ activeModel, contents, config, onProgress, requestId }) {
    const candidates = [
      activeModel,
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite'
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastError = null;
    for (let i = 0; i < candidates.length; i++) {
      const modelToUse = candidates[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await Promise.race([
          this.ai.models.generateContent({
            model: modelToUse,
            contents,
            config
          }),
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error(`Gemini request timed out after 20s on model ${modelToUse}`));
            });
          })
        ]);
        clearTimeout(timeoutId);
        return { response, usedModel: modelToUse };
      } catch (err) {
        lastError = err;
        const errMsg = err.message || '';
        const isTransient = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('timed out') || errMsg.includes('404') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Quota exceeded');
        logger.warn('ai', 'gemini_model_retry', `Model ${modelToUse} failed (${errMsg}).`, { requestId, isTransient });

        if (isTransient && i < candidates.length - 1) {
          const nextModel = candidates[i + 1];
          logger.info('ai', 'gemini_failover_triggered', `Failing over to ${nextModel}...`, { requestId });
          if (onProgress) {
            onProgress({ stage: 'searching_sources', text: `${modelToUse} limit/busy, switching to ${nextModel}...` });
          }
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Main conversational loop with tool-calling and timeout protection
   */
  async chat({
    conversationId = null,
    userId = 1,
    message,
    history = [],
    onProgress = null,
    requestId = null,
    model = null
  }) {
    let activeModel = (model || this.modelName || 'gemini-3-flash-preview').trim();

    if (!this.apiKey) {
      return {
        reply: `⚠️ **Gemini API Key Required**\n\nPlease configure your Gemini API Key in the **Settings** tab to enable AI search and intelligence across WhatsApp, Gmail, and Google Drive.\n\nOnce configured, I will automatically search your connected accounts and answer questions.`,
        sources: [],
        tokenUsage: null,
        model: activeModel
      };
    }

    this.initClient();
    if (!this.ai) {
      throw new Error('Gemini client could not be initialized.');
    }

    if (onProgress) {
      onProgress({ stage: 'analyzing_question', text: 'Analyzing your question...' });
    }

    logger.info('ai', 'chat_request_start', `Prompt: "${message.substring(0, 60)}..."`, {
      requestId,
      details: { conversationId, model: activeModel, historyCount: history.length }
    });

    const systemInstruction = `You are Unified AI Workspace, a senior executive intelligence assistant.
Your goal is to provide accurate, consolidated answers based on local data synchronized from WhatsApp, Gmail, and Google Drive.

CRITICAL INSTRUCTIONS:
1. Always use the provided search tools to find facts. Never fabricate conversations, emails, agreements, or payments.
2. When answering about a person or company, query cross-platform tools (e.g. search_all_sources, get_client_profile, get_client_timeline).
3. Clearly distinguish between:
   - Confirmed facts (e.g. "Invoice #102 was signed on 12 Oct").
   - Discussed statements (e.g. "Rahul mentioned on WhatsApp that he would wire the rent by Friday").
   - AI inferences (e.g. "Based on the thread, this appears to be the same project").
   - Missing or conflicting information.
4. Always cite your sources with platform and identifier (e.g. [WhatsApp: Rahul], [Gmail: Agreement Subject], [Drive: Rental_Agreement.pdf]).
5. Structure long answers with clear Markdown headings, bullet points, and summaries.`;

    const toolDeclarations = this.getToolDeclarations();
    const contents = [];

    // Add recent history if provided with strict alternating role validation
    if (history && history.length > 0) {
      let lastRole = null;
      for (const h of history) {
        const text = (h.content || '').trim();
        if (text) {
          const role = h.sender === 'user' ? 'user' : 'model';
          if (role === lastRole) {
            // Append to previous message of the same role
            contents[contents.length - 1].parts[0].text += `\n${text}`;
          } else {
            contents.push({
              role,
              parts: [{ text }]
            });
            lastRole = role;
          }
        }
      }
    }

    // Ensure the upcoming user prompt doesn't follow another user message
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. How can I assist you with your workspace records?' }]
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const maxIterations = 7;
    let iteration = 0;
    const collectedSources = [];
    let finalReply = '';
    let usageMetadata = null;

    while (iteration < maxIterations) {
      iteration++;
      logger.info('ai', 'gemini_call_iteration', `Iteration ${iteration}/${maxIterations} with model ${activeModel}`, { requestId });

      let response;
      try {
        const callResult = await this.callModelWithFailover({
          activeModel,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: toolDeclarations }]
          },
          onProgress,
          requestId
        });
        response = callResult.response;
        activeModel = callResult.usedModel;
      } catch (geminiErr) {
        logger.error('ai', 'gemini_api_error', geminiErr.message, { requestId, error: geminiErr });
        if (onProgress) onProgress({ stage: 'failed', text: `Gemini API error: ${geminiErr.message}` });
        throw geminiErr;
      }

      usageMetadata = response.usageMetadata || usageMetadata;
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Check if candidate contains function calls
      const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);

      if (functionCalls.length === 0) {
        // Model provided final text response
        const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
        finalReply = textParts.trim();
        break;
      }

      // Add model's functionCall message to contents
      contents.push({
        role: 'model',
        parts
      });

      const toolResponseParts = [];
      for (const fc of functionCalls) {
        if (onProgress) {
          let stageDesc = `Searching local data for "${fc.args?.q || message.substring(0, 30)}"...`;
          if (fc.name.includes('whatsapp')) stageDesc = 'Searching WhatsApp conversations...';
          else if (fc.name.includes('gmail')) stageDesc = 'Searching Gmail messages & threads...';
          else if (fc.name.includes('drive')) stageDesc = 'Searching Google Drive documents...';
          else if (fc.name.includes('timeline')) stageDesc = 'Building chronological client timeline...';
          else if (fc.name.includes('payment')) stageDesc = 'Analyzing payment and financial references...';
          onProgress({ stage: 'searching_sources', text: stageDesc, tool: fc.name });
        }

        const toolResult = await this.executeTool(fc.name, fc.args || {}, onProgress, requestId);

        // Record sources for citations
        if (Array.isArray(toolResult)) {
          toolResult.forEach(item => {
            if (item.platform && (item.title || item.snippet)) {
              collectedSources.push({
                sourcePlatform: item.platform,
                recordId: String(item.recordId || item.id || ''),
                title: item.title || item.filename || item.subject || 'Record',
                snippet: item.snippet ? item.snippet.substring(0, 200) : ''
              });
            }
          });
        }

        toolResponseParts.push({
          functionResponse: {
            id: fc.id,
            name: fc.name,
            response: { result: toolResult }
          }
        });
      }

      // The role for function responses in Google Generative AI / @google/genai is 'user'
      contents.push({
        role: 'user',
        parts: toolResponseParts
      });

      if (onProgress) {
        onProgress({ stage: 'generating_response', text: 'Analyzing matching information and synthesizing report...' });
      }
    }

    // If loop finished because iteration limit reached without generating text,
    // invoke Gemini for final synthesis without tools
    if (!finalReply || !finalReply.trim()) {
      logger.info('ai', 'gemini_final_synthesis', `Generating final response from collected tool results`, { requestId });
      if (onProgress) {
        onProgress({ stage: 'generating_response', text: 'Synthesizing final answer from search results...' });
      }

      try {
        const synthCallResult = await this.callModelWithFailover({
          activeModel,
          contents,
          config: {
            systemInstruction: systemInstruction + `\n\nCRITICAL INSTRUCTION: Synthesize all search tool outputs above to directly and thoroughly answer the user's question: "${message}". If no records or relevant information was found, state clearly and politely that no records matching "${message}" were found in the connected accounts.`
          },
          onProgress,
          requestId
        });
        const synthRes = synthCallResult.response;
        activeModel = synthCallResult.usedModel;
        const synthCandidate = synthRes.candidates?.[0];
        const synthParts = synthCandidate?.content?.parts || [];
        finalReply = synthParts.filter(p => p.text).map(p => p.text).join('\n').trim();
        usageMetadata = synthRes.usageMetadata || usageMetadata;
      } catch (synthErr) {
        logger.warn('ai', 'gemini_synthesis_failed', synthErr.message, { requestId, error: synthErr });
      }
    }

    // Absolute deterministic fallback: NEVER return an empty string
    if (!finalReply || !finalReply.trim()) {
      if (collectedSources.length > 0) {
        finalReply = `I found ${collectedSources.length} relevant record(s) matching your request. Please see the cited sources.`;
      } else {
        finalReply = `I searched your connected sources (WhatsApp, Gmail, and Google Drive) for "${message}", but no matching messages, emails, or documents were found.`;
      }
    }

    if (onProgress) {
      onProgress({ stage: 'completed', text: 'Response ready' });
    }

    logger.info('ai', 'chat_request_complete', `Response generated successfully (${finalReply.length} chars)`, {
      requestId,
      details: {
        sourcesCount: collectedSources.length,
        tokenUsage: usageMetadata
      }
    });

    return {
      reply: finalReply,
      sources: collectedSources.slice(0, 10),
      tokenUsage: usageMetadata,
      model: activeModel
    };
  }
}

export const geminiService = new GeminiService();
export default geminiService;
