import { query } from '../../config/db.js';
import config from '../../config/env.js';
import { encryptCredential, decryptCredential } from '../../utils/crypto.js';
import logger from '../../utils/logger.js';
import geminiProvider from './providers/geminiProvider.js';
import geminiService from './geminiService.js';
import openaiProvider from './providers/openaiProvider.js';
import anthropicProvider from './providers/anthropicProvider.js';

class AIManager {
  constructor() {
    this.providers = {
      gemini: {
        name: 'Google Gemini',
        adapter: geminiProvider,
        defaultModel: config.gemini.model || 'gemini-3-flash-preview'
      },
      openai: {
        name: 'OpenAI / ChatGPT',
        adapter: openaiProvider,
        defaultModel: 'gpt-4o'
      },
      anthropic: {
        name: 'Anthropic Claude',
        adapter: anthropicProvider,
        defaultModel: 'claude-3-7-sonnet-20250219'
      }
    };
  }

  /**
   * Helper to mask an API key (e.g. ••••••••••••abcd)
   */
  maskKey(key) {
    if (!key || typeof key !== 'string') return '';
    const trimmed = key.trim();
    if (trimmed.length <= 4) return '••••' + trimmed;
    const last4 = trimmed.slice(-4);
    return '••••••••••••' + last4;
  }

  /**
   * Resolve an unencrypted API key for a provider
   */
  async getApiKey(provider) {
    // 1. Check process environment first (e.g. GEMINI_API_KEY)
    if (provider === 'gemini' && config.gemini.apiKey) {
      return config.gemini.apiKey.trim();
    }
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY.trim();
    }
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY.trim();
    }

    // 2. Check encrypted database record in ai_provider_configs
    try {
      const [row] = await query(
        `SELECT api_key_encrypted FROM ai_provider_configs WHERE provider = ? LIMIT 1`,
        [provider]
      );
      if (row && row.api_key_encrypted) {
        const decrypted = decryptCredential(row.api_key_encrypted);
        return decrypted ? String(decrypted).trim() : null;
      }
    } catch (e) {
      logger.warn('ai', 'get_api_key_db_error', `Could not load DB key for ${provider}: ${e.message}`);
    }

    // 3. Fallback to app_settings (legacy gemini_api_key)
    if (provider === 'gemini') {
      try {
        const [appRow] = await query(`SELECT setting_value FROM app_settings WHERE setting_key = 'gemini_api_key' LIMIT 1`);
        if (appRow?.setting_value) return appRow.setting_value.trim();
      } catch {
        // ignore
      }
    }

    return null;
  }

  /**
   * Retrieve status and metadata for all providers (with masked keys)
   */
  async getProviderConfigs() {
    const rows = await query(`SELECT * FROM ai_provider_configs`);
    const dbMap = {};
    rows.forEach(r => { dbMap[r.provider] = r; });

    // Read default provider from app_settings
    let defaultProvider = 'gemini';
    try {
      const [defRow] = await query(`SELECT setting_value FROM app_settings WHERE setting_key = 'default_ai_provider' LIMIT 1`);
      if (defRow?.setting_value) defaultProvider = defRow.setting_value;
    } catch {
      // ignore
    }

    const configs = [];
    for (const [providerId, meta] of Object.entries(this.providers)) {
      const dbRow = dbMap[providerId] || {};
      const actualKey = await this.getApiKey(providerId);
      const isConfigured = !!actualKey;

      let status = dbRow.status || (isConfigured ? 'configured' : 'not_configured');
      if (!isConfigured) {
        status = 'not_configured';
      }

      configs.push({
        provider: providerId,
        name: meta.name,
        isConfigured,
        maskedKey: isConfigured ? this.maskKey(actualKey) : '',
        defaultModel: dbRow.default_model || meta.defaultModel,
        status,
        statusMessage: dbRow.status_message || (isConfigured ? 'Ready for queries' : 'API key required'),
        lastTestedAt: dbRow.last_tested_at || null,
        isDefaultProvider: defaultProvider === providerId
      });
    }

    return {
      success: true,
      defaultProvider,
      providers: configs
    };
  }

  /**
   * Save provider configuration with encryption
   */
  async saveProviderConfig({ provider, apiKey, defaultModel }) {
    if (!this.providers[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const updates = [];
    const params = [];

    if (apiKey !== undefined && apiKey !== null && apiKey.trim().length > 0) {
      const cleanKey = apiKey.trim();
      const encryptedKey = encryptCredential(cleanKey);
      updates.push(`api_key_encrypted = ?`);
      params.push(encryptedKey);

      // If gemini, also sync with runtime config & geminiService
      if (provider === 'gemini') {
        config.gemini.apiKey = cleanKey;
        geminiService.updateConfig({ apiKey: cleanKey });
      }
    }

    if (defaultModel) {
      updates.push(`default_model = ?`);
      params.push(defaultModel);
      if (provider === 'gemini') {
        config.gemini.model = defaultModel;
        geminiService.updateConfig({ model: defaultModel });
      }
    }

    updates.push(`status = 'configured'`);
    updates.push(`status_message = 'Configuration saved'`);

    const sql = `
      INSERT INTO ai_provider_configs (provider, default_model, status, status_message)
      VALUES (?, ?, 'configured', 'Configuration saved')
      ON DUPLICATE KEY UPDATE ${updates.join(', ')}
    `;

    await query(sql, [provider, defaultModel || this.providers[provider].defaultModel, ...params]);

    // Also persist in app_settings for default provider model tracking
    if (defaultModel) {
      await query(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [`default_${provider}_model`, defaultModel, `Default model for ${provider}`]
      ).catch(() => {});
    }

    return {
      success: true,
      message: `${this.providers[provider].name} configuration saved successfully.`
    };
  }

  /**
   * Remove provider configuration
   */
  async removeProviderConfig(provider) {
    if (!this.providers[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    await query(
      `UPDATE ai_provider_configs 
       SET api_key_encrypted = NULL, status = 'not_configured', status_message = 'API key removed', models_cache_json = NULL
       WHERE provider = ?`,
      [provider]
    );

    if (provider === 'gemini') {
      // Clear runtime key
      config.gemini.apiKey = '';
      geminiService.updateConfig({ apiKey: '' });
      await query(`DELETE FROM app_settings WHERE setting_key = 'gemini_api_key'`).catch(() => {});
    }

    return {
      success: true,
      message: `${this.providers[provider].name} configuration removed.`
    };
  }

  /**
   * Set application default AI provider
   */
  async setDefaultProvider(provider) {
    if (!this.providers[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
    await query(
      `INSERT INTO app_settings (setting_key, setting_value, description)
       VALUES ('default_ai_provider', ?, 'Active default AI provider (gemini, openai, anthropic)')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [provider]
    );
    return { success: true, defaultProvider: provider };
  }

  /**
   * Test connection to a provider
   */
  async testProvider(provider, targetModel = null) {
    if (!this.providers[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      return {
        success: false,
        provider,
        status: 'not_configured',
        error: `No API key configured for ${this.providers[provider].name}. Please supply an API key.`
      };
    }

    const adapter = this.providers[provider].adapter;
    const testResult = await adapter.testConnection(apiKey, targetModel);

    const newStatus = testResult.success ? 'connected' : (testResult.status || 'failed');
    const newMsg = testResult.success
      ? (testResult.reply || 'Connected successfully')
      : (testResult.error || 'Connection failed');

    await query(
      `UPDATE ai_provider_configs 
       SET status = ?, status_message = ?, last_tested_at = CURRENT_TIMESTAMP 
       WHERE provider = ?`,
      [newStatus, newMsg, provider]
    ).catch(() => {});

    return testResult;
  }

  /**
   * List available models dynamically from provider
   */
  async listModels(provider = 'gemini') {
    if (!this.providers[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const apiKey = await this.getApiKey(provider);
    const adapter = this.providers[provider].adapter;
    const result = await adapter.listModels(apiKey);

    // Cache models list in DB if successful
    if (result.success && Array.isArray(result.models) && result.models.length > 0) {
      await query(
        `UPDATE ai_provider_configs SET models_cache_json = ? WHERE provider = ?`,
        [JSON.stringify(result.models), provider]
      ).catch(() => {});
    }

    // Get current default model
    const [row] = await query(`SELECT default_model FROM ai_provider_configs WHERE provider = ? LIMIT 1`, [provider]);
    const currentModel = row?.default_model || this.providers[provider].defaultModel;

    return {
      success: true,
      provider,
      currentModel,
      models: result.models || [],
      source: result.source || 'api'
    };
  }

  /**
   * Unified chat dispatch
   */
  async chat({
    provider = 'gemini',
    model = null,
    message,
    messages = null,
    history = [],
    conversationId = null,
    userId = 1,
    requestId = 'req-ai',
    onProgress = null
  }) {
    const selectedProvider = (provider || 'gemini').toLowerCase();
    if (!this.providers[selectedProvider]) {
      throw new Error(`AI Provider "${selectedProvider}" is not supported.`);
    }

    const actualMessage = message || (Array.isArray(messages) ? messages[messages.length - 1]?.content : String(messages || ''));

    const apiKey = await this.getApiKey(selectedProvider);
    if (!apiKey) {
      throw new Error(
        `API key for ${this.providers[selectedProvider].name} is not configured. Please configure it in Application Settings.`
      );
    }

    // Resolve model
    let modelToUse = model;
    if (!modelToUse) {
      const [row] = await query(
        `SELECT default_model FROM ai_provider_configs WHERE provider = ? LIMIT 1`,
        [selectedProvider]
      );
      modelToUse = row?.default_model || this.providers[selectedProvider].defaultModel;
    }

    logger.info('ai', 'chat_dispatch', `Dispatching query to [${selectedProvider}] with model [${modelToUse}]`, {
      requestId,
      details: { provider: selectedProvider, model: modelToUse }
    });

    const adapter = this.providers[selectedProvider].adapter;
    const result = await adapter.chat({
      message: actualMessage,
      history,
      model: modelToUse,
      apiKey,
      requestId,
      onProgress,
      conversationId,
      userId
    });

    return {
      ...result,
      provider: selectedProvider,
      model: modelToUse
    };
  }
}

export const aiManager = new AIManager();
export default aiManager;
