import OpenAI from 'openai';
import BaseAIProvider from './baseProvider.js';
import { getOpenAITools, executeTool } from '../aiTools.js';
import logger from '../../../utils/logger.js';

export class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super('openai', 'gpt-4o');
  }

  getClient(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured.');
    }
    return new OpenAI({ apiKey });
  }

  async testConnection(apiKey, targetModel = null) {
    const t0 = Date.now();
    const modelToTest = targetModel || this.defaultModel;
    try {
      const client = this.getClient(apiKey);
      // Fast probe using models list
      const models = await client.models.list();
      const durationMs = Date.now() - t0;
      return {
        success: true,
        provider: 'openai',
        model: modelToTest,
        durationMs,
        reply: `Connected successfully. Retrieved ${models.data.length} OpenAI models in ${durationMs}ms.`
      };
    } catch (err) {
      const durationMs = Date.now() - t0;
      let status = 'failed';
      let message = err.message || 'Unknown OpenAI error';
      if (err.status === 401 || err.code === 'invalid_api_key') {
        status = 'invalid_key';
        message = 'Invalid OpenAI API key. Please check your credentials.';
      } else if (err.status === 429) {
        status = 'quota_exceeded';
        message = 'OpenAI API quota exceeded or rate limit reached. Check billing.';
      }
      return {
        success: false,
        provider: 'openai',
        status,
        durationMs,
        error: message
      };
    }
  }

  async listModels(apiKey = null) {
    const fallbackModels = [
      { id: 'gpt-4o', name: 'GPT-4o (Omni)', provider: 'openai', contextWindow: '128,000 tokens', toolCalling: true, streaming: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)', provider: 'openai', contextWindow: '128,000 tokens', toolCalling: true, streaming: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: '128,000 tokens', toolCalling: true, streaming: true },
      { id: 'o1', name: 'OpenAI o1 (Reasoning)', provider: 'openai', contextWindow: '200,000 tokens', toolCalling: true, streaming: false },
      { id: 'o3-mini', name: 'OpenAI o3-mini (STEM & Code)', provider: 'openai', contextWindow: '200,000 tokens', toolCalling: true, streaming: true }
    ];

    if (!apiKey) {
      return { success: true, models: fallbackModels, source: 'curated' };
    }

    try {
      const client = this.getClient(apiKey);
      const res = await client.models.list();
      const chatModels = res.data
        .filter(m => m.id.startsWith('gpt-4') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('chatgpt'))
        .filter(m => !m.id.includes('instruct') && !m.id.includes('realtime') && !m.id.includes('audio'))
        .sort((a, b) => b.created - a.created)
        .map(m => {
          const isToolSupported = !m.id.startsWith('o1');
          return {
            id: m.id,
            name: this.formatModelName(m.id),
            provider: 'openai',
            contextWindow: m.id.includes('o') ? '128k - 200k tokens' : '128,000 tokens',
            toolCalling: isToolSupported,
            streaming: !m.id.startsWith('o1'),
            created: m.created
          };
        });

      return {
        success: true,
        models: chatModels.length > 0 ? chatModels : fallbackModels,
        source: 'api'
      };
    } catch {
      return { success: true, models: fallbackModels, source: 'fallback' };
    }
  }

  formatModelName(id) {
    if (id === 'gpt-4o') return 'GPT-4o (Omni)';
    if (id === 'gpt-4o-mini') return 'GPT-4o Mini (Fast & Efficient)';
    if (id === 'gpt-4-turbo') return 'GPT-4 Turbo';
    if (id === 'o1') return 'OpenAI o1 Reasoning';
    if (id === 'o3-mini') return 'OpenAI o3-mini';
    return id.toUpperCase();
  }

  async chat({ message, history = [], model = null, apiKey = null, requestId = 'req-ai', onProgress = null }) {
    const activeModel = model || this.defaultModel;
    const client = this.getClient(apiKey);

    if (onProgress) {
      onProgress({ stage: 'analyzing_question', text: 'Analyzing your question with OpenAI...' });
    }

    const systemPrompt = `You are the AI Assistant for Unified AI Workspace, a local-first application connecting WhatsApp, Gmail, and Google Drive.
Your goal is to provide accurate, consolidated answers based on local data synchronized from WhatsApp, Gmail, and Drive.

CRITICAL INSTRUCTIONS:
1. Always search connected sources first before answering questions about clients, contacts, payments, rental agreements, dates, or discussions.
2. Formulate clear citations indicating where information was found (e.g. "[WhatsApp: Rahul Sharma, 10:15 AM]" or "[Gmail: Invoice #1042]").
3. Never fabricate payments, dates, commitments, or messages. If records are not found, state that clearly.`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Append prior conversation history
    for (const h of (history || []).slice(-15)) {
      const role = h.sender === 'user' ? 'user' : 'assistant';
      if (h.content && h.content.trim()) {
        messages.push({ role, content: h.content.trim() });
      }
    }

    // Append current prompt
    messages.push({ role: 'user', content: message.trim() });

    const tools = getOpenAITools();
    let iterations = 0;
    const maxIterations = 6;
    const sources = [];
    let tokenUsage = null;

    while (iterations < maxIterations) {
      iterations++;
      logger.info('ai', 'openai_chat_turn', `Turn ${iterations}/${maxIterations} with model ${activeModel}`, { requestId });

      const response = await client.chat.completions.create({
        model: activeModel,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
        temperature: 0.2
      });

      const choice = response.choices?.[0];
      const resMsg = choice?.message;
      if (response.usage) {
        tokenUsage = response.usage;
      }

      if (!resMsg) {
        throw new Error('Received empty response from OpenAI');
      }

      messages.push(resMsg);

      // Handle Tool Calls
      if (resMsg.tool_calls && resMsg.tool_calls.length > 0) {
        if (onProgress) {
          onProgress({ stage: 'searching_sources', text: `Searching workspace records...` });
        }

        for (const tc of resMsg.tool_calls) {
          const fnName = tc.function?.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(tc.function?.arguments || '{}');
          } catch {
            fnArgs = {};
          }

          const toolResult = await executeTool(fnName, fnArgs, requestId, onProgress);
          sources.push({
            tool: fnName,
            args: fnArgs,
            sourcePlatform: fnName.includes('whatsapp') ? 'whatsapp' : (fnName.includes('gmail') ? 'gmail' : (fnName.includes('drive') ? 'drive' : 'unified')),
            title: `Tool: ${fnName}`,
            snippet: JSON.stringify(toolResult).substring(0, 300)
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult || {})
          });
        }
        continue;
      }

      // Final response produced
      if (onProgress) {
        onProgress({ stage: 'completed', text: 'Response ready' });
      }

      return {
        reply: resMsg.content || 'No response generated.',
        provider: 'openai',
        model: activeModel,
        sources,
        tokenUsage
      };
    }

    // Synthesize final fallback if iteration limit reached
    const finalCompletion = await client.chat.completions.create({
      model: activeModel,
      messages: [
        ...messages,
        { role: 'user', content: 'Please summarize your findings into a concise, direct answer now.' }
      ]
    });

    return {
      reply: finalCompletion.choices?.[0]?.message?.content || 'Completed data analysis.',
      provider: 'openai',
      model: activeModel,
      sources,
      tokenUsage: finalCompletion.usage || tokenUsage
    };
  }
}

export const openaiProvider = new OpenAIProvider();
export default openaiProvider;
