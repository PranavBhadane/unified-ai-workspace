import Anthropic from '@anthropic-ai/sdk';
import BaseAIProvider from './baseProvider.js';
import { getAnthropicTools, executeTool } from '../aiTools.js';
import logger from '../../../utils/logger.js';

export class AnthropicProvider extends BaseAIProvider {
  constructor() {
    super('anthropic', 'claude-3-7-sonnet-20250219');
  }

  getClient(apiKey) {
    if (!apiKey) {
      throw new Error('Anthropic API key is not configured.');
    }
    return new Anthropic({ apiKey });
  }

  async testConnection(apiKey, targetModel = null) {
    const t0 = Date.now();
    const modelToTest = targetModel || this.defaultModel;
    try {
      const client = this.getClient(apiKey);
      // Fast probe using model listing
      const models = await client.models.list();
      const durationMs = Date.now() - t0;
      return {
        success: true,
        provider: 'anthropic',
        model: modelToTest,
        durationMs,
        reply: `Connected successfully. Retrieved ${models.data.length} Claude models in ${durationMs}ms.`
      };
    } catch (err) {
      const durationMs = Date.now() - t0;
      let status = 'failed';
      let message = err.message || 'Unknown Anthropic error';
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('authentication')) {
        status = 'invalid_key';
        message = 'Invalid Anthropic Claude API key. Please check your credentials.';
      } else if (err.status === 429 || err.message?.includes('quota') || err.message?.includes('rate_limit')) {
        status = 'quota_exceeded';
        message = 'Anthropic Claude API quota exceeded or rate limit reached. Check billing.';
      }
      return {
        success: false,
        provider: 'anthropic',
        status,
        durationMs,
        error: message
      };
    }
  }

  async listModels(apiKey = null) {
    const fallbackModels = [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Latest & Hybrid)', provider: 'anthropic', contextWindow: '200,000 tokens', toolCalling: true, streaming: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art)', provider: 'anthropic', contextWindow: '200,000 tokens', toolCalling: true, streaming: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (High Speed)', provider: 'anthropic', contextWindow: '200,000 tokens', toolCalling: true, streaming: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Complex Analysis)', provider: 'anthropic', contextWindow: '200,000 tokens', toolCalling: true, streaming: true },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Compact)', provider: 'anthropic', contextWindow: '200,000 tokens', toolCalling: true, streaming: true }
    ];

    if (!apiKey) {
      return { success: true, models: fallbackModels, source: 'curated' };
    }

    try {
      const client = this.getClient(apiKey);
      const res = await client.models.list();
      const models = res.data
        .filter(m => m.id.startsWith('claude'))
        .map(m => ({
          id: m.id,
          name: m.display_name || this.formatModelName(m.id),
          provider: 'anthropic',
          contextWindow: '200,000 tokens',
          toolCalling: true,
          streaming: true,
          created: m.created_at
        }));

      return {
        success: true,
        models: models.length > 0 ? models : fallbackModels,
        source: 'api'
      };
    } catch {
      return { success: true, models: fallbackModels, source: 'fallback' };
    }
  }

  formatModelName(id) {
    if (id.includes('3-7-sonnet')) return 'Claude 3.7 Sonnet';
    if (id.includes('3-5-sonnet')) return 'Claude 3.5 Sonnet';
    if (id.includes('3-5-haiku')) return 'Claude 3.5 Haiku';
    if (id.includes('3-opus')) return 'Claude 3 Opus';
    if (id.includes('3-haiku')) return 'Claude 3 Haiku';
    return id;
  }

  async chat({ message, history = [], model = null, apiKey = null, requestId = 'req-ai', onProgress = null }) {
    const activeModel = model || this.defaultModel;
    const client = this.getClient(apiKey);

    if (onProgress) {
      onProgress({ stage: 'analyzing_question', text: 'Analyzing your question with Claude...' });
    }

    const systemPrompt = `You are the AI Assistant for Unified AI Workspace, a local-first application connecting WhatsApp, Gmail, and Google Drive.
Your goal is to provide accurate, consolidated answers based on local data synchronized from WhatsApp, Gmail, and Drive.

CRITICAL INSTRUCTIONS:
1. Always search connected sources first before answering questions about clients, contacts, payments, rental agreements, dates, or discussions.
2. Formulate clear citations indicating where information was found (e.g. "[WhatsApp: Rahul Sharma, 10:15 AM]" or "[Gmail: Invoice #1042]").
3. Never fabricate payments, dates, commitments, or messages. If records are not found, state that clearly.`;

    const messages = [];

    // Append prior history (ensure strict alternating user/assistant roles)
    let lastRole = null;
    for (const h of (history || []).slice(-15)) {
      const role = h.sender === 'user' ? 'user' : 'assistant';
      if (h.content && h.content.trim()) {
        if (role !== lastRole) {
          messages.push({ role, content: h.content.trim() });
          lastRole = role;
        }
      }
    }

    if (lastRole === 'user') {
      messages.push({ role: 'assistant', content: 'Understood.' });
    }
    messages.push({ role: 'user', content: message.trim() });

    const tools = getAnthropicTools();
    let iterations = 0;
    const maxIterations = 6;
    const sources = [];
    let tokenUsage = null;

    while (iterations < maxIterations) {
      iterations++;
      logger.info('ai', 'claude_chat_turn', `Turn ${iterations}/${maxIterations} with model ${activeModel}`, { requestId });

      const response = await client.messages.create({
        model: activeModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.2
      });

      if (response.usage) {
        tokenUsage = response.usage;
      }

      // Check for tool use
      if (response.stop_reason === 'tool_use') {
        if (onProgress) {
          onProgress({ stage: 'searching_sources', text: `Searching workspace records...` });
        }

        // Add assistant's message with tool use content blocks
        messages.push({ role: 'assistant', content: response.content });

        const toolResultBlocks = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const toolResult = await executeTool(block.name, block.input || {}, requestId, onProgress);
            sources.push({
              tool: block.name,
              args: block.input,
              sourcePlatform: block.name.includes('whatsapp') ? 'whatsapp' : (block.name.includes('gmail') ? 'gmail' : (block.name.includes('drive') ? 'drive' : 'unified')),
              title: `Tool: ${block.name}`,
              snippet: JSON.stringify(toolResult).substring(0, 300)
            });

            toolResultBlocks.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(toolResult || {})
            });
          }
        }

        messages.push({ role: 'user', content: toolResultBlocks });
        continue;
      }

      // Final response produced
      const textBlock = response.content.find(b => b.type === 'text');
      const reply = textBlock?.text || 'No response content.';

      if (onProgress) {
        onProgress({ stage: 'completed', text: 'Response ready' });
      }

      return {
        reply,
        provider: 'anthropic',
        model: activeModel,
        sources,
        tokenUsage
      };
    }

    return {
      reply: 'Completed data analysis.',
      provider: 'anthropic',
      model: activeModel,
      sources,
      tokenUsage
    };
  }
}

export const anthropicProvider = new AnthropicProvider();
export default anthropicProvider;
