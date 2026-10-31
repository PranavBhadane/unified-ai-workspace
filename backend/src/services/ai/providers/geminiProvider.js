import { GoogleGenAI } from '@google/genai';
import { BaseAIProvider } from './baseProvider.js';
import geminiService from '../geminiService.js';
import config from '../../../config/env.js';
import logger from '../../../utils/logger.js';

export class GeminiProvider extends BaseAIProvider {
  constructor() {
    super('gemini', 'gemini-3-flash-preview');
  }

  /**
   * Test API connectivity and authorization
   */
  async testConnection(apiKey = null, model = null) {
    const key = apiKey || config.gemini.apiKey;
    if (!key) {
      return {
        success: false,
        status: 'not_configured',
        error: 'No Gemini API key supplied or configured.'
      };
    }

    const testModel = model || 'gemini-3-flash-preview';
    try {
      const ai = new GoogleGenAI({ apiKey: key.trim() });
      const response = await ai.models.generateContent({
        model: testModel,
        contents: 'Respond with exactly: "Google Gemini Connected"'
      });

      const reply = response.text ? response.text.trim() : 'Connected';
      return {
        success: true,
        status: 'connected',
        provider: 'gemini',
        model: testModel,
        reply
      };
    } catch (err) {
      logger.warn('ai', `Gemini test connection failed on model ${testModel}`, { error: err.message });
      return {
        success: false,
        status: 'failed',
        provider: 'gemini',
        model: testModel,
        error: err.message
      };
    }
  }

  /**
   * List available models dynamically from Gemini API
   */
  async listModels(apiKey = null) {
    const key = apiKey || config.gemini.apiKey;
    if (!key) {
      return {
        success: true,
        source: 'fallback',
        models: this.getCuratedModels()
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: key.trim() });
      const pager = await ai.models.list();
      const rawModels = [];

      for await (const m of pager) {
        const id = m.name.replace(/^models\//, '');
        // Filter out non-text/specialized models (embeddings, tts, vision-only, robotics)
        if (
          !id.includes('embedding') &&
          !id.includes('tts') &&
          !id.includes('transcribe') &&
          !id.includes('robotics') &&
          !id.includes('audio') &&
          !id.includes('image') &&
          !id.includes('clip') &&
          !id.includes('lyria') &&
          (id.includes('flash') || id.includes('pro') || id.includes('gemma'))
        ) {
          rawModels.push({
            id,
            name: this.formatModelName(id),
            description: m.description || `Google Gemini ${id}`
          });
        }
      }

      if (rawModels.length > 0) {
        return {
          success: true,
          source: 'api',
          models: rawModels
        };
      }

      return {
        success: true,
        source: 'curated',
        models: this.getCuratedModels()
      };
    } catch (err) {
      logger.warn('ai', `Failed to dynamically list Gemini models: ${err.message}`, { error: err.message });
      return {
        success: true,
        source: 'fallback',
        models: this.getCuratedModels()
      };
    }
  }

  formatModelName(id) {
    if (id === 'gemini-3-flash-preview') return 'Gemini 3 Flash (Preview - Recommended)';
    if (id === 'gemini-3.8-flash') return 'Gemini 3.8 Flash';
    if (id === 'gemini-3.1-flash-lite') return 'Gemini 3.1 Flash Lite';
    if (id === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro (Preview)';
    if (id === 'gemini-flash-latest') return 'Gemini Flash (Latest)';
    if (id === 'gemini-pro-latest') return 'Gemini Pro (Latest)';
    return id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getCuratedModels() {
    return [
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash (Preview - Recommended)',
        description: 'Next-generation fast frontier model with advanced tool calling.'
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: 'Latest high-speed multimodal Gemini model.'
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        description: 'Ultra-low latency lightweight model.'
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro (Preview)',
        description: 'High-reasoning intelligence model for complex queries.'
      }
    ];
  }

  /**
   * Main chat dispatch delegates to geminiService
   */
  async chat(params) {
    return await geminiService.chat(params);
  }
}

export const geminiProvider = new GeminiProvider();
export default geminiProvider;
