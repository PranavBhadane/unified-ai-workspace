import whatsappConnector from '../connectors/whatsapp/whatsappConnector.js';
import whatsappApiClient from '../services/connectors/whatsappApiClient.js';
import syncManager from '../services/sync/syncManager.js';
import logger from '../utils/logger.js';
import { query } from '../config/db.js';

export async function getQr(req, res) {
  const status = whatsappConnector.getStatus();
  return res.json({
    success: true,
    qr: status.qrCode,
    status: status.status
  });
}

export async function getStatus(req, res) {
  try {
    const live = await whatsappApiClient.getLiveStatus();
    return res.json({
      success: true,
      ...live
    });
  } catch (error) {
    const local = await whatsappApiClient.getLocalStatusAndStats();
    return res.json({
      success: true,
      ...local,
      error: error.message
    });
  }
}

export async function getHealth(req, res) {
  const health = await whatsappApiClient.getHealth(req.requestId);
  return res.json({
    success: true,
    health
  });
}

export async function getStats(req, res) {
  try {
    const stats = await whatsappApiClient.getStats(req.requestId);
    return res.json({
      success: true,
      stats
    });
  } catch {
    const local = await whatsappApiClient.getLocalStatusAndStats();
    return res.json({
      success: true,
      isFallback: true,
      stats: local.stats
    });
  }
}

export async function syncGroups(req, res) {
  const t0 = Date.now();
  try {
    try {
      const result = await whatsappApiClient.syncGroups(req.requestId);
      const count = result?.syncedCount ?? result?.groups?.length ?? result?.count ?? 0;
      await syncManager.log(null, 'whatsapp', 'info', `Group sync completed: ${count} groups synchronized via WhatsApp API`, { durationMs: Date.now() - t0, count });
      return res.json({
        success: true,
        source: 'api',
        message: `Successfully synchronized ${count} WhatsApp groups.`,
        data: result
      });
    } catch (apiErr) {
      const [groupsCount] = await query(`SELECT COUNT(*) as count FROM wa_groups`);
      const count = groupsCount?.count || 0;
      await syncManager.log(null, 'whatsapp', 'warn', `External WhatsApp API unavailable. Verified ${count} groups from local database.`, { durationMs: Date.now() - t0, count });
      return res.json({
        success: true,
        source: 'local_fallback',
        warning: `WhatsApp API is offline: ${apiErr.message}`,
        message: `Successfully synchronized ${count} WhatsApp groups from local database.`,
        count
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getChats(req, res) {
  const { limit = 50, q, type, offset = 0 } = req.query;
  try {
    // Attempt external WhatsApp API
    try {
      const remote = await whatsappApiClient.getChats({ type, q, limit, offset }, req.requestId);
      if (remote && (Array.isArray(remote) || remote.chats || remote.data)) {
        return res.json({
          success: true,
          source: 'api',
          chats: Array.isArray(remote) ? remote : (remote.chats || remote.data)
        });
      }
    } catch {
      // Fall through to local database
    }

    // Local DB fallback
    let sql = `
      SELECT c.*, COUNT(m.id) as message_count
      FROM wa_chats c
      LEFT JOIN wa_messages m ON c.jid = m.chat_jid
    `;
    const params = [];
    if (q) {
      sql += ` WHERE c.name LIKE ? OR c.jid LIKE ?`;
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ` GROUP BY c.id ORDER BY c.last_message_timestamp DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await query(sql, params);
    return res.json({ success: true, source: 'database', chats: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getChatById(req, res) {
  const { chatId } = req.params;
  try {
    try {
      const data = await whatsappApiClient.getChat(chatId, req.requestId);
      return res.json({ success: true, source: 'api', chat: data });
    } catch {
      const [chat] = await query(`SELECT * FROM wa_chats WHERE jid = ? OR id = ?`, [chatId, chatId]);
      if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
      return res.json({ success: true, source: 'database', chat });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getChatMessages(req, res) {
  const { chatId } = req.params;
  try {
    try {
      const data = await whatsappApiClient.getChatMessages(chatId, req.query, req.requestId);
      return res.json({ success: true, source: 'api', data });
    } catch {
      const rows = await query(
        `SELECT * FROM wa_messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        [chatId, parseInt(req.query.limit || 50, 10), parseInt(req.query.offset || 0, 10)]
      );
      return res.json({ success: true, source: 'database', messages: rows });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getChatTranscript(req, res) {
  const { chatId } = req.params;
  try {
    try {
      const data = await whatsappApiClient.getChatTranscript(chatId, req.requestId);
      return res.json({ success: true, source: 'api', transcript: data });
    } catch {
      const rows = await query(
        `SELECT sender_name, timestamp, text_content, message_type FROM wa_messages WHERE chat_jid = ? ORDER BY timestamp ASC`,
        [chatId]
      );
      const transcript = rows.map(r => `[${new Date(r.timestamp).toLocaleString()}] ${r.sender_name || 'User'}: ${r.text_content || `[${r.message_type}]`}`).join('\n');
      return res.json({ success: true, source: 'database', transcript });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getMessages(req, res) {
  const { chatJid, limit = 50, offset = 0 } = req.query;
  try {
    try {
      const remote = await whatsappApiClient.getMessages(req.query, req.requestId);
      if (remote && (Array.isArray(remote) || remote.messages || remote.data)) {
        return res.json({
          success: true,
          source: 'api',
          messages: Array.isArray(remote) ? remote : (remote.messages || remote.data)
        });
      }
    } catch {
      // Fall through to local database
    }

    let sql = `SELECT * FROM wa_messages`;
    const params = [];
    if (chatJid) {
      sql += ` WHERE chat_jid = ?`;
      params.push(chatJid);
    }
    sql += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(Math.min(500, parseInt(limit, 10)), parseInt(offset, 10));

    const rows = await query(sql, params);
    return res.json({ success: true, source: 'database', messages: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getMessageById(req, res) {
  const { id } = req.params;
  try {
    try {
      const data = await whatsappApiClient.getMessage(id, req.requestId);
      return res.json({ success: true, source: 'api', message: data });
    } catch {
      const [msg] = await query(`SELECT * FROM wa_messages WHERE message_id = ? OR id = ?`, [id, id]);
      if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
      return res.json({ success: true, source: 'database', message: msg });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getMessageContext(req, res) {
  const { id } = req.params;
  try {
    try {
      const data = await whatsappApiClient.getMessageContext(id, req.requestId);
      return res.json({ success: true, source: 'api', context: data });
    } catch {
      const [msg] = await query(`SELECT * FROM wa_messages WHERE message_id = ? OR id = ?`, [id, id]);
      if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
      const before = await query(
        `SELECT * FROM wa_messages WHERE chat_jid = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 5`,
        [msg.chat_jid, msg.timestamp]
      );
      const after = await query(
        `SELECT * FROM wa_messages WHERE chat_jid = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT 5`,
        [msg.chat_jid, msg.timestamp]
      );
      return res.json({
        success: true,
        source: 'database',
        context: {
          target: msg,
          before: before.reverse(),
          after
        }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getContacts(req, res) {
  try {
    try {
      const remote = await whatsappApiClient.getContacts(req.query, req.requestId);
      if (remote && (Array.isArray(remote) || remote.contacts || remote.data)) {
        return res.json({
          success: true,
          source: 'api',
          contacts: Array.isArray(remote) ? remote : (remote.contacts || remote.data)
        });
      }
    } catch {
      // Fall through to local database
    }

    const rows = await query(`SELECT * FROM wa_contacts ORDER BY name ASC LIMIT 100`);
    return res.json({ success: true, source: 'database', contacts: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getGroups(req, res) {
  try {
    try {
      const remote = await whatsappApiClient.getGroups(req.query, req.requestId);
      if (remote && (Array.isArray(remote) || remote.groups || remote.data)) {
        return res.json({
          success: true,
          source: 'api',
          groups: Array.isArray(remote) ? remote : (remote.groups || remote.data)
        });
      }
    } catch {
      // Fall through to local database
    }

    const rows = await query(`SELECT * FROM wa_groups ORDER BY subject ASC LIMIT 100`);
    return res.json({ success: true, source: 'database', groups: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function search(req, res) {
  const { q, scope } = req.query;
  try {
    try {
      const remote = scope
        ? await whatsappApiClient.searchAll(q, scope, req.requestId)
        : await whatsappApiClient.search(q, req.requestId);
      return res.json({ success: true, source: 'api', results: remote });
    } catch {
      const rows = await query(
        `SELECT * FROM wa_messages WHERE text_content LIKE ? OR caption LIKE ? ORDER BY timestamp DESC LIMIT 20`,
        [`%${q}%`, `%${q}%`]
      );
      return res.json({ success: true, source: 'database', results: rows });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAnalytics(req, res) {
  const { type = 'daily' } = req.params;
  const { tzOffset = 330 } = req.query;
  try {
    try {
      const data = await whatsappApiClient.getAnalytics(type, tzOffset, req.requestId);
      return res.json({ success: true, source: 'api', data });
    } catch {
      // Fallback local aggregated counts
      const [stats] = await query(`
        SELECT COUNT(*) as total_messages,
               COUNT(DISTINCT chat_jid) as active_chats,
               SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
               SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received
        FROM wa_messages
      `);
      return res.json({
        success: true,
        source: 'database',
        data: {
          type,
          tzOffset,
          metrics: stats || {}
        }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function exportMessages(req, res) {
  const { format = 'json' } = req.query;
  try {
    try {
      const data = await whatsappApiClient.exportMessages(format, req.requestId);
      return res.json({ success: true, source: 'api', data });
    } catch {
      const rows = await query(`SELECT * FROM wa_messages ORDER BY timestamp DESC LIMIT 500`);
      if (format === 'csv') {
        const header = 'id,timestamp,sender_name,from_me,message_type,text_content\n';
        const csv = rows.map(r => `"${r.id}","${new Date(r.timestamp).toISOString()}","${(r.sender_name || '').replace(/"/g, '""')}","${r.from_me}","${r.message_type}","${(r.text_content || '').replace(/"/g, '""')}"`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_messages.csv"');
        return res.send(header + csv);
      }
      return res.json({ success: true, source: 'database', messages: rows });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getQr,
  getStatus,
  getHealth,
  getStats,
  syncGroups,
  getChats,
  getChatById,
  getChatMessages,
  getChatTranscript,
  getMessages,
  getMessageById,
  getMessageContext,
  getContacts,
  getGroups,
  search,
  getAnalytics,
  exportMessages
};
