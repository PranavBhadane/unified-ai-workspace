import { query } from '../config/db.js';
import whatsappConnector from '../connectors/whatsapp/whatsappConnector.js';
import gmailConnector from '../connectors/gmail/gmailConnector.js';
import driveConnector from '../connectors/drive/driveConnector.js';

export async function getConnections(req, res) {
  try {
    const accounts = await query(`
      SELECT 
        id, platform, account_identifier, account_name, status, last_sync_at, created_at, updated_at
      FROM connected_accounts
    `);

    // WhatsApp real-time state
    const waStatus = whatsappConnector.getStatus();

    const connectors = [
      {
        platform: 'whatsapp',
        name: 'WhatsApp',
        description: 'Connect via WhatsApp Linked Devices (Baileys)',
        status: waStatus.status === 'connected' ? 'connected' : (waStatus.status === 'qr_ready' ? 'qr_ready' : 'disconnected'),
        account: accounts.find(a => a.platform === 'whatsapp') || null,
        details: {
          hasQr: waStatus.hasQr,
          connectionState: waStatus.status
        }
      },
      {
        platform: 'gmail',
        name: 'Gmail',
        description: 'Official Gmail API (Read-only OAuth 2.0)',
        status: accounts.find(a => a.platform === 'gmail' && a.status === 'connected') ? 'connected' : 'disconnected',
        account: accounts.find(a => a.platform === 'gmail') || null
      },
      {
        platform: 'drive',
        name: 'Google Drive',
        description: 'Google Drive API v3 (Read-only OAuth 2.0)',
        status: accounts.find(a => a.platform === 'drive' && a.status === 'connected') ? 'connected' : 'disconnected',
        account: accounts.find(a => a.platform === 'drive') || null
      }
    ];

    return res.json({ success: true, connectors });
  } catch (error) {
    console.error('getConnections error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function connectPlatform(req, res) {
  const { platform } = req.params;
  try {
    if (platform === 'whatsapp') {
      await whatsappConnector.initializeSocket(req.user?.id || 1);
      const status = whatsappConnector.getStatus();
      return res.json({ success: true, message: 'WhatsApp initialization triggered', status });
    } else if (platform === 'gmail') {
      const authUrl = gmailConnector.getAuthUrl('gmail');
      return res.json({ success: true, authUrl });
    } else if (platform === 'drive') {
      const authUrl = driveConnector.getAuthUrl('drive');
      return res.json({ success: true, authUrl });
    } else {
      return res.status(400).json({ success: false, error: 'Unknown platform' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function handleGoogleCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`http://localhost:5173/connections?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect('http://localhost:5173/connections?error=Missing+authorization+code');
  }

  try {
    if (state === 'drive') {
      await driveConnector.handleCallback(code, req.user?.id || 1);
    } else {
      await gmailConnector.handleCallback(code, req.user?.id || 1);
    }
    return res.redirect('http://localhost:5173/connections?success=true');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`http://localhost:5173/connections?error=${encodeURIComponent(err.message)}`);
  }
}

export async function disconnectPlatform(req, res) {
  const { platform } = req.params;
  try {
    const [acc] = await query(`SELECT id FROM connected_accounts WHERE platform = ?`, [platform]);
    if (platform === 'whatsapp') {
      await whatsappConnector.disconnect();
    } else if (platform === 'gmail') {
      if (acc) await gmailConnector.disconnect(acc.id);
    } else if (platform === 'drive') {
      if (acc) await driveConnector.disconnect(acc.id);
    }
    return res.json({ success: true, message: `Disconnected from ${platform}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getConnections,
  connectPlatform,
  handleGoogleCallback,
  disconnectPlatform
};
