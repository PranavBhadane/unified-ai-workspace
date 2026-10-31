import { query } from '../config/db.js';
import config from '../config/env.js';
import storageManager from '../services/storage/storageManager.js';
import geminiService from '../services/ai/geminiService.js';

export async function getSettings(req, res) {
  try {
    const rows = await query(`SELECT setting_key, setting_value, description FROM app_settings`);
    const settingsMap = {};
    rows.forEach(r => {
      try {
        settingsMap[r.setting_key] = JSON.parse(r.setting_value);
      } catch {
        settingsMap[r.setting_key] = r.setting_value;
      }
    });

    const storageStats = storageManager.getStorageStats();

    return res.json({
      success: true,
      settings: {
        ...settingsMap,
        geminiApiKeyConfigured: !!(config.gemini.apiKey || settingsMap.gemini_api_key),
        geminiModel: settingsMap.gemini_model || config.gemini.model,
        googleOAuthClientId: config.google.clientId ? `${config.google.clientId.substring(0, 12)}...` : '',
        googleOAuthConfigured: !!(config.google.clientId && config.google.clientSecret),
        storagePath: config.storage.rootPath,
        storageStats
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateSettings(req, res) {
  const { geminiApiKey, geminiModel, syncIntervalMins, autoSyncEnabled, allowedSources } = req.body;

  try {
    if (geminiApiKey !== undefined && geminiApiKey.trim() !== '') {
      config.gemini.apiKey = geminiApiKey.trim();
      await query(
        `INSERT INTO app_settings (setting_key, setting_value, description, is_encrypted)
         VALUES ('gemini_api_key', ?, 'User supplied Gemini API key', true)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [geminiApiKey.trim()]
      );
      geminiService.updateConfig({ apiKey: geminiApiKey.trim() });
    }

    if (geminiModel) {
      config.gemini.model = geminiModel;
      await query(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES ('gemini_model', ?, 'Active Gemini LLM model')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [geminiModel]
      );
      geminiService.updateConfig({ model: geminiModel });
    }

    if (syncIntervalMins !== undefined) {
      await query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES ('sync_interval_mins', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(syncIntervalMins)]
      );
    }

    if (autoSyncEnabled !== undefined) {
      await query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES ('auto_sync_enabled', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(autoSyncEnabled)]
      );
    }

    if (allowedSources !== undefined) {
      await query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES ('ai_allowed_sources', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [JSON.stringify(allowedSources)]
      );
    }

    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getStorageStats(req, res) {
  try {
    const stats = storageManager.getStorageStats();
    return res.json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getSettings,
  updateSettings,
  getStorageStats
};
