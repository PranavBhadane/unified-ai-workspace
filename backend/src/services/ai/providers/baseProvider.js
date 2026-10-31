/**
 * Base AI Provider Interface
 * All provider adapters (Gemini, OpenAI, Anthropic) inherit from this base class
 */
export class BaseAIProvider {
  constructor(name, defaultModel) {
    this.name = name;
    this.defaultModel = defaultModel;
  }

  /**
   * Test API connectivity and authorization
   */
  async testConnection(apiKey = null, model = null) {
    throw new Error('testConnection must be implemented by provider');
  }

  /**
   * List available models dynamically from provider API
   */
  async listModels(apiKey = null) {
    throw new Error('listModels must be implemented by provider');
  }

  /**
   * Send chat query and synthesize response using multi-turn tool calling
   */
  async chat({ message, history = [], model = null, apiKey = null, requestId = 'req-ai', onProgress = null }) {
    throw new Error('chat must be implemented by provider');
  }
}

export default BaseAIProvider;
