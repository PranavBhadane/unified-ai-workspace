import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import searchEngine from '../search/searchEngine.js';
import entityResolver from '../entities/entityResolver.js';
import whatsappApiClient from '../connectors/whatsappApiClient.js';
import { query } from '../../config/db.js';
import config from '../../config/env.js';
import logger from '../../utils/logger.js';

export const AI_TOOL_DEFINITIONS = [
  {
    name: 'search_whatsapp_messages',
    description: 'Search WhatsApp messages by keyword, contact name, or phrase.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search term or phrase' },
        limit: { type: 'integer', description: 'Maximum number of results (default 10)' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_whatsapp_contacts',
    description: 'Search WhatsApp contacts and phone numbers.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Contact name or phone number' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_whatsapp_groups',
    description: 'Search WhatsApp groups and descriptions.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Group subject or keyword' }
      },
      required: ['q']
    }
  },
  {
    name: 'get_whatsapp_message_context',
    description: 'Retrieve contextual conversation messages immediately before and after a specific WhatsApp message ID.',
    parameters: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'WhatsApp message unique ID' }
      },
      required: ['messageId']
    }
  },
  {
    name: 'get_whatsapp_chat_transcript',
    description: 'Retrieve the complete chat history or transcript of a specific WhatsApp conversation.',
    parameters: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'WhatsApp chat JID or ID' },
        limit: { type: 'integer', description: 'Number of messages to retrieve (default 50)' }
      },
      required: ['chatId']
    }
  },
  {
    name: 'whatsapp_mcp_query',
    description: 'Perform deep contextual retrieval or execute an MCP tool on WhatsApp data for commitments, agreements, or payments.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or question to evaluate' },
        action: { type: 'string', description: 'Action type (e.g. search, summarize, analyze)' }
      },
      required: ['query']
    }
  },
  {
    name: 'search_gmail_messages',
    description: 'Search Gmail emails by subject, body content, sender, or recipient.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search keyword, sender email, or subject line' },
        limit: { type: 'integer', description: 'Maximum number of results (default 10)' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_gmail_threads',
    description: 'Retrieve all messages in a specific Gmail thread.',
    parameters: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Gmail thread ID' }
      },
      required: ['threadId']
    }
  },
  {
    name: 'search_drive_files',
    description: 'Search Google Drive documents, spreadsheets, PDFs, and presentations by name or type.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'File name keyword or extension' },
        limit: { type: 'integer', description: 'Maximum results to retrieve (default 10)' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_drive_content',
    description: 'Deep semantic and keyword search across indexed text content of Drive files and PDFs.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Topic or search phrase to match in document text' },
        limit: { type: 'integer', description: 'Maximum excerpts (default 10)' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_all_sources',
    description: 'Search across WhatsApp, Gmail, Google Drive, and indexed document chunks simultaneously.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Query phrase to match across all sources' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of platforms to search: ["whatsapp", "gmail", "drive"]'
        },
        limit: { type: 'integer', description: 'Maximum total items' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_contacts',
    description: 'Lookup contacts by name, email, or phone number across WhatsApp and Gmail.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Contact name, email address, or phone number' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_entities',
    description: 'Search canonical unified client, vendor, or project entity profiles.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Entity name, company name, or domain' }
      },
      required: ['q']
    }
  },
  {
    name: 'get_client_profile',
    description: 'Retrieve consolidated client dossier including WhatsApp chats, emails, Drive files, and aliases.',
    parameters: {
      type: 'object',
      properties: {
        clientNameOrId: { type: 'string', description: 'Entity ID or client name' }
      },
      required: ['clientNameOrId']
    }
  },
  {
    name: 'get_client_timeline',
    description: 'Retrieve a unified chronological timeline of all interactions across WhatsApp, Gmail, and Drive for a specific person or company.',
    parameters: {
      type: 'object',
      properties: {
        clientNameOrId: { type: 'string', description: 'Entity ID or person/company name' }
      },
      required: ['clientNameOrId']
    }
  },
  {
    name: 'get_document_details',
    description: 'Retrieve metadata and parsed text chunks of a specific stored document or Drive file.',
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID or database record ID' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'get_conversation_summary',
    description: 'Retrieve recent messages and context of a specific WhatsApp chat conversation.',
    parameters: {
      type: 'object',
      properties: {
        chatJid: { type: 'string', description: 'WhatsApp remote chat JID' }
      },
      required: ['chatJid']
    }
  },
  {
    name: 'find_payment_references',
    description: 'Scan across emails, WhatsApp, and Drive for payment mentions, invoices, rental amounts, bank transfers, or quotations.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Specific client, invoice number, or payment topic' }
      },
      required: ['query']
    }
  },
  {
    name: 'find_pending_commitments',
    description: 'Search for unresolved action items, promised deliverables, pending approvals, or deadlines in communications.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Person or context to filter commitments' }
      },
      required: ['query']
    }
  }
];

/**
 * Execute an approved backend retrieval tool
 */
export async function executeTool(name, args = {}, requestId = 'req-tool', onProgress = null) {
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
        } catch {
          // Fall through to local database
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
        } catch {
          // Fall through
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
        } catch {
          // Fall through
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
        } catch {
          // Fall through
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
        } catch {
          // Fall through
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
        } catch {
          // Fall through
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
        const queryTerm = String(args.fileId || '').trim();
        let file = null;
        if (/^\d+$/.test(queryTerm)) {
          const [f] = await query(`SELECT * FROM drive_files WHERE id = ?`, [parseInt(queryTerm, 10)]);
          file = f;
        }
        if (!file) {
          const [f] = await query(`SELECT * FROM drive_files WHERE file_id = ? OR name LIKE ? LIMIT 1`, [queryTerm, `%${queryTerm}%`]);
          file = f;
        }

        if (!file) {
          result = { error: `Document not found matching "${queryTerm}"` };
          break;
        }

        let parsedData = null;
        if (file.local_file_path) {
          const fullPath = path.resolve(config.storage.rootPath, file.local_file_path);
          if (fs.existsSync(fullPath)) {
            const ext = path.extname(file.name).toLowerCase();
            if (['.xlsx', '.xls', '.csv'].includes(ext) || file.mime_type.includes('spreadsheet')) {
              try {
                const workbook = XLSX.readFile(fullPath);
                const sheets = {};
                for (const name of workbook.SheetNames) {
                  const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
                  sheets[name] = data.slice(0, 100);
                }
                parsedData = { type: 'spreadsheet', sheetNames: workbook.SheetNames, sheets };
              } catch (e) {
                parsedData = { error: `Failed to read spreadsheet: ${e.message}` };
              }
            }
          }
        }

        const chunks = await query(`SELECT chunk_text FROM document_chunks WHERE file_id = ? ORDER BY chunk_index ASC LIMIT 10`, [file.id]);
        result = {
          file: {
            id: file.id,
            name: file.name,
            mimeType: file.mime_type,
            sizeBytes: file.size_bytes,
            downloadUrl: `/api/documents/drive_${file.id}/download`,
            previewUrl: `/api/documents/drive_${file.id}/preview`
          },
          spreadsheetData: parsedData,
          textChunks: chunks.map(c => c.chunk_text)
        };
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
          // Fall through
        }
        result = await query(
          `SELECT sender_name, timestamp, text_content, caption, message_type
           FROM wa_messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT 20`,
          [args.chatJid]
        );
        break;
      }

      case 'find_payment_references':
        result = await entityResolver.findPaymentReferences(args.query || '');
        break;

      case 'find_pending_commitments':
        result = await entityResolver.findPendingCommitments(args.query || '');
        break;

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

/**
 * Format tools for OpenAI function calling
 */
export function getOpenAITools() {
  return AI_TOOL_DEFINITIONS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required || []
      }
    }
  }));
}

/**
 * Format tools for Anthropic Claude function calling
 */
export function getAnthropicTools() {
  return AI_TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: tool.parameters.properties,
      required: tool.parameters.required || []
    }
  }));
}

/**
 * Format tools for Gemini function calling
 */
export function getGeminiTools() {
  return AI_TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([k, v]) => [
          k,
          {
            type: v.type.toUpperCase(),
            description: v.description
          }
        ])
      ),
      required: tool.parameters.required || []
    }
  }));
}

export default {
  AI_TOOL_DEFINITIONS,
  executeTool,
  getOpenAITools,
  getAnthropicTools,
  getGeminiTools
};
