import aiManager from '../services/ai/aiManager.js';
import syncManager from '../services/sync/syncManager.js';
import { query } from '../config/db.js';
import logger from '../utils/logger.js';

export async function chat(req, res) {
  const { message, conversationId, provider, model } = req.body;
  const userId = req.user?.id || 1;
  const requestId = req.requestId || 'req-ai';

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'EMPTY_MESSAGE', message: 'A non-empty message string is required', requestId }
    });
  }

  const promptText = message.trim();
  let activeConvId = conversationId;

  // Resolve active provider and model
  let activeProvider = provider || 'gemini';
  let activeModel = model;

  try {
    // 1. Ensure conversation exists
    if (!activeConvId) {
      const convTitle = promptText.length > 40 ? `${promptText.substring(0, 40)}...` : promptText;
      const convRes = await query(
        `INSERT INTO ai_conversations (user_id, title, provider, model) VALUES (?, ?, ?, ?)`,
        [userId, convTitle, activeProvider, activeModel]
      );
      activeConvId = convRes.insertId;
      logger.info('ai', 'conversation_created', `Created conversation #${activeConvId}: "${convTitle}" [${activeProvider}:${activeModel}]`, { requestId });
    } else {
      // If conversation exists, load or update its configured provider and model
      const [existingConv] = await query(`SELECT provider, model FROM ai_conversations WHERE id = ?`, [activeConvId]);
      if (existingConv) {
        if (!provider && existingConv.provider) {
          activeProvider = existingConv.provider;
        }
        if (!model && existingConv.model) {
          activeModel = existingConv.model;
        }
        if (provider || model) {
          await query(
            `UPDATE ai_conversations SET provider = ?, model = ? WHERE id = ?`,
            [activeProvider, activeModel, activeConvId]
          ).catch(() => {});
        }
      }
    }

    // 2. IMMEDIATELY persist the user's message so history is NEVER lost
    const userMsgRes = await query(
      `INSERT INTO ai_messages (conversation_id, sender, provider, model, content) VALUES (?, 'user', ?, ?, ?)`,
      [activeConvId, activeProvider, activeModel, promptText]
    );
    const userMsgId = userMsgRes.insertId;

    // 3. Fetch prior conversation message history (ordered chronologically)
    const history = await query(
      `SELECT id, sender, content FROM ai_messages 
       WHERE conversation_id = ? AND id != ? 
       ORDER BY id ASC LIMIT 20`,
      [activeConvId, userMsgId]
    );

    // 4. Progress broadcaster callback
    const onProgress = (step) => {
      syncManager.broadcast('ai:progress', {
        conversationId: activeConvId,
        requestId,
        ...step
      });
    };

    onProgress({ stage: 'preparing_request', text: 'Preparing query...' });

    // 5. Call AI Manager with tool-calling and multi-provider dispatch
    const aiResult = await aiManager.chat({
      provider: activeProvider,
      model: activeModel,
      message: promptText,
      history,
      conversationId: activeConvId,
      userId,
      requestId,
      onProgress
    });

    const safeReply = (aiResult.reply || '').trim() ||
      `I searched your connected sources (WhatsApp, Gmail, and Google Drive), but no records matching your request were found.`;

    // 6. Persist assistant message and citations
    const botMsgRes = await query(
      `INSERT INTO ai_messages (conversation_id, sender, provider, model, content, citations_json, token_usage_json)
       VALUES (?, 'assistant', ?, ?, ?, ?, ?)`,
      [
        activeConvId,
        aiResult.provider || activeProvider,
        aiResult.model || activeModel,
        safeReply,
        JSON.stringify(aiResult.sources || []),
        JSON.stringify(aiResult.tokenUsage || null)
      ]
    );
    const botMsgId = botMsgRes.insertId;

    // Persist citations in ai_query_sources
    if (Array.isArray(aiResult.sources)) {
      for (const s of aiResult.sources.slice(0, 10)) {
        await query(
          `INSERT INTO ai_query_sources (message_id, source_platform, record_id, title, snippet)
           VALUES (?, ?, ?, ?, ?)`,
          [botMsgId, s.sourcePlatform || 'unified', s.recordId || '', s.title || '', s.snippet || '']
        );
      }
    }

    // Touch conversation updated_at
    await query(`UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [activeConvId]);

    logger.info('ai', 'chat_response_delivered', `Delivered response for conv #${activeConvId} [${aiResult.provider}:${aiResult.model}]`, {
      requestId,
      details: {
        conversationId: activeConvId,
        provider: aiResult.provider,
        model: aiResult.model,
        sourcesCount: (aiResult.sources || []).length
      }
    });

    return res.json({
      success: true,
      conversationId: activeConvId,
      userMessageId: userMsgId,
      assistantMessageId: botMsgId,
      reply: safeReply,
      provider: aiResult.provider || activeProvider,
      model: aiResult.model || activeModel,
      sources: aiResult.sources || [],
      tokenUsage: aiResult.tokenUsage || null,
      requestId
    });
  } catch (error) {
    logger.error('ai', 'chat_error', error.message, { requestId, error });

    syncManager.broadcast('ai:progress', {
      conversationId: activeConvId,
      requestId,
      stage: 'failed',
      text: error.message
    });

    return res.status(500).json({
      success: false,
      error: {
        code: error.code || 'AI_QUERY_FAILED',
        message: error.message || 'An error occurred while generating the AI response.',
        requestId
      },
      conversationId: activeConvId
    });
  }
}

export async function getConversations(req, res) {
  const userId = req.user?.id || 1;
  const requestId = req.requestId || 'req-convs';

  try {
    const rows = await query(
      `SELECT c.id, c.user_id, c.title, c.provider, c.model, c.created_at, c.updated_at,
        (SELECT content FROM ai_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = c.id) as message_count
       FROM ai_conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({ success: true, conversations: rows, requestId });
  } catch (error) {
    logger.error('ai', 'get_conversations_error', error.message, { requestId, error });
    return res.status(500).json({
      success: false,
      error: { code: 'CONVERSATIONS_FETCH_FAILED', message: error.message, requestId }
    });
  }
}

export async function createConversation(req, res) {
  const userId = req.user?.id || 1;
  const { title = 'New Conversation', provider = 'gemini', model } = req.body;
  const requestId = req.requestId || 'req-conv-create';

  try {
    const defaultProvider = provider || 'gemini';
    let defaultModel = model;
    if (!defaultModel) {
      const [row] = await query(`SELECT default_model FROM ai_provider_configs WHERE provider = ? LIMIT 1`, [defaultProvider]);
      defaultModel = row?.default_model || (defaultProvider === 'gemini' ? 'gemini-3.1-flash-lite' : (defaultProvider === 'openai' ? 'gpt-4o' : 'claude-3-7-sonnet-20250219'));
    }

    const result = await query(
      `INSERT INTO ai_conversations (user_id, title, provider, model) VALUES (?, ?, ?, ?)`,
      [userId, title, defaultProvider, defaultModel]
    );

    const newConv = {
      id: result.insertId,
      user_id: userId,
      title,
      provider: defaultProvider,
      model: defaultModel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0
    };

    logger.info('ai', 'create_conversation', `Created new conversation #${newConv.id} [${defaultProvider}:${defaultModel}]`, { requestId });

    return res.json({
      success: true,
      conversation: newConv,
      requestId
    });
  } catch (error) {
    logger.error('ai', 'create_conversation_error', error.message, { requestId, error });
    return res.status(500).json({
      success: false,
      error: { code: 'CONVERSATION_CREATE_FAILED', message: error.message, requestId }
    });
  }
}

export async function getConversation(req, res) {
  const { id } = req.params;
  const requestId = req.requestId || 'req-conv-detail';

  try {
    const [conv] = await query(`SELECT * FROM ai_conversations WHERE id = ?`, [id]);
    if (!conv) {
      return res.status(404).json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: `Conversation #${id} not found`, requestId }
      });
    }

    const messages = await query(
      `SELECT id, conversation_id, sender, provider, model, content, citations_json, token_usage_json, created_at 
       FROM ai_messages 
       WHERE conversation_id = ? 
       ORDER BY id ASC`,
      [id]
    );

    const formattedMessages = messages.map(m => {
      let citations = [];
      let tokenUsage = null;
      try { citations = typeof m.citations_json === 'string' ? JSON.parse(m.citations_json) : (m.citations_json || []); } catch {}
      try { tokenUsage = typeof m.token_usage_json === 'string' ? JSON.parse(m.token_usage_json) : m.token_usage_json; } catch {}
      return {
        id: m.id,
        conversationId: m.conversation_id,
        sender: m.sender,
        provider: m.provider || conv.provider || 'gemini',
        model: m.model || conv.model || 'gemini-3.1-flash-lite',
        content: m.content,
        citations,
        tokenUsage,
        createdAt: m.created_at
      };
    });

    return res.json({
      success: true,
      conversation: {
        id: conv.id,
        title: conv.title,
        provider: conv.provider || 'gemini',
        model: conv.model || 'gemini-3.1-flash-lite',
        createdAt: conv.created_at,
        updatedAt: conv.updated_at
      },
      messages: formattedMessages,
      requestId
    });
  } catch (error) {
    logger.error('ai', 'get_conversation_detail_error', error.message, { requestId, error });
    return res.status(500).json({
      success: false,
      error: { code: 'CONVERSATION_FETCH_FAILED', message: error.message, requestId }
    });
  }
}

export async function getMessageSources(req, res) {
  const { messageId } = req.params;
  try {
    const rows = await query(`SELECT * FROM ai_query_sources WHERE message_id = ?`, [messageId]);
    return res.json({ success: true, sources: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ==================== PROVIDER CONFIGURATION & MODELS ====================

export async function getProviderConfigs(req, res) {
  try {
    const data = await aiManager.getProviderConfigs();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function saveProviderConfig(req, res) {
  const { provider, apiKey, defaultModel } = req.body;
  try {
    const data = await aiManager.saveProviderConfig({ provider, apiKey, defaultModel });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function removeProviderConfig(req, res) {
  const { provider } = req.params;
  try {
    const data = await aiManager.removeProviderConfig(provider);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function testProviderConnection(req, res) {
  const { provider } = req.params;
  const { model } = req.body || {};
  try {
    const data = await aiManager.testProvider(provider, model);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function setDefaultProvider(req, res) {
  const { provider } = req.body;
  try {
    const data = await aiManager.setDefaultProvider(provider);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAvailableModels(req, res) {
  const provider = (req.query.provider || 'gemini').toLowerCase();
  try {
    const data = await aiManager.listModels(provider);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  chat,
  getConversations,
  createConversation,
  getConversation,
  getMessageSources,
  getProviderConfigs,
  saveProviderConfig,
  removeProviderConfig,
  testProviderConnection,
  setDefaultProvider,
  getAvailableModels
};
