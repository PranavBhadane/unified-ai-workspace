import syncManager from '../services/sync/syncManager.js';
import gmailConnector from '../connectors/gmail/gmailConnector.js';
import driveConnector from '../connectors/drive/driveConnector.js';
import whatsappConnector from '../connectors/whatsapp/whatsappConnector.js';
import whatsappApiClient from '../services/connectors/whatsappApiClient.js';
import { query } from '../config/db.js';

export async function getStatus(req, res) {
  try {
    const status = await syncManager.getStatus();
    return res.json({ success: true, status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getHistory(req, res) {
  const { limit = 25 } = req.query;
  try {
    const history = await syncManager.getHistory(parseInt(limit, 10));
    return res.json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function startSync(req, res) {
  const { platform } = req.body;
  if (!platform) {
    return res.status(400).json({ success: false, error: 'Platform is required' });
  }

  try {
    const [acc] = await query(`SELECT id, status FROM connected_accounts WHERE platform = ?`, [platform]);
    if (!acc && platform !== 'whatsapp') {
      return res.status(400).json({ success: false, error: `No connected account found for ${platform}` });
    }

    // Start background sync job based on platform
    if (platform === 'gmail') {
      // Async trigger without blocking HTTP request
      gmailConnector.sync(acc.id, 50).catch(err => {
        console.error('[Gmail Sync Error]:', err.message);
      });
      return res.json({ success: true, message: 'Gmail synchronization started in background.' });
    } else if (platform === 'drive') {
      driveConnector.sync(acc.id, 50).catch(err => {
        console.error('[Drive Sync Error]:', err.message);
      });
      return res.json({ success: true, message: 'Google Drive synchronization started in background.' });
    } else if (platform === 'whatsapp') {
      whatsappConnector.initializeSocket(req.user?.id || 1).catch(err => {
        console.error('[WhatsApp Socket Error]:', err.message);
      });
      return res.json({ success: true, message: 'WhatsApp connection/sync initialized.' });
    } else {
      return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function stopSync(req, res) {
  const { platform } = req.body;
  if (!platform) {
    return res.status(400).json({ success: false, error: 'Platform is required' });
  }
  try {
    const cancelled = await syncManager.cancelJob(platform);
    return res.json({ success: true, cancelled });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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
      await syncManager.log(null, 'whatsapp', 'warn', `External WhatsApp API offline (${apiErr.message}). Verified ${count} groups from local workspace database.`, { durationMs: Date.now() - t0, count });
      return res.json({
        success: true,
        source: 'local_fallback',
        warning: `WhatsApp API service is offline: ${apiErr.message}`,
        message: `Successfully verified ${count} WhatsApp groups from local database.`,
        count
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getStatus,
  getHistory,
  startSync,
  stopSync,
  syncGroups
};
