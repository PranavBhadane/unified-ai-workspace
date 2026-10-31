import { google } from 'googleapis';
import config from '../../config/env.js';
import { query } from '../../config/db.js';
import { encryptCredential, decryptCredential } from '../../utils/crypto.js';
import syncManager from '../../services/sync/syncManager.js';
import storageManager from '../../services/storage/storageManager.js';
import documentExtractor from '../../services/documents/documentExtractor.js';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

class GmailConnector {
  getOAuth2Client() {
    return new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  getAuthUrl(state = 'gmail') {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new Error('Google OAuth Client ID and Secret are not configured. Please set them in Settings or .env.');
    }
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GMAIL_SCOPES,
      state
    });
  }

  async handleCallback(code, userId = 1) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's Google email profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    const name = userInfo.data.name || email;

    const encryptedTokens = encryptCredential(tokens);

    // Upsert connected_account
    const existing = await query(
      `SELECT id FROM connected_accounts WHERE user_id = ? AND platform = 'gmail' AND account_identifier = ?`,
      [userId, email]
    );

    let accountId;
    if (existing.length > 0) {
      accountId = existing[0].id;
      await query(
        `UPDATE connected_accounts 
         SET status = 'connected', account_name = ?, credentials_encrypted = ?, scopes = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, encryptedTokens, JSON.stringify(GMAIL_SCOPES), JSON.stringify(userInfo.data), accountId]
      );
    } else {
      const res = await query(
        `INSERT INTO connected_accounts (user_id, platform, account_identifier, account_name, status, scopes, credentials_encrypted, metadata_json)
         VALUES (?, 'gmail', ?, ?, 'connected', ?, ?, ?)`,
        [userId, email, name, JSON.stringify(GMAIL_SCOPES), encryptedTokens, JSON.stringify(userInfo.data)]
      );
      accountId = res.insertId;
    }

    // Persist session
    await query(
      `INSERT INTO connector_sessions (connected_account_id, session_key, session_data_encrypted, expires_at)
       VALUES (?, 'oauth_tokens', ?, ?)
       ON DUPLICATE KEY UPDATE session_data_encrypted = VALUES(session_data_encrypted), expires_at = VALUES(expires_at)`,
      [accountId, encryptedTokens, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
    );

    return { accountId, email, name };
  }

  async getAuthenticatedClient(accountId) {
    const [acc] = await query(
      `SELECT credentials_encrypted FROM connected_accounts WHERE id = ? AND platform = 'gmail'`,
      [accountId]
    );
    if (!acc || !acc.credentials_encrypted) {
      throw new Error(`Gmail account #${accountId} credentials not found.`);
    }

    const tokens = decryptCredential(acc.credentials_encrypted);
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Listen for refresh tokens
    oauth2Client.on('tokens', async (newTokens) => {
      const updated = { ...tokens, ...newTokens };
      const encrypted = encryptCredential(updated);
      await query(
        `UPDATE connected_accounts SET credentials_encrypted = ? WHERE id = ?`,
        [encrypted, accountId]
      );
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Helper to parse email headers
   */
  getHeader(headers, name) {
    const h = headers.find(header => header.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
  }

  /**
   * Helper to parse sender info "John Doe <john@example.com>"
   */
  parseSender(fromString) {
    if (!fromString) return { name: '', email: '' };
    const match = fromString.match(/^(.*?)(?:<(.+?)>)?$/);
    if (!match) return { name: fromString, email: fromString };
    const name = match[1].replace(/"/g, '').trim();
    const email = (match[2] || match[1]).replace(/[<>]/g, '').trim();
    return { name: name || email, email };
  }

  /**
   * Recursive extraction of body parts
   */
  extractBody(payload) {
    let plain = '';
    let html = '';

    const traverse = (part) => {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        plain += Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
        html += Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach(traverse);
      }
    };

    if (payload.parts) {
      payload.parts.forEach(traverse);
    } else if (payload.body && payload.body.data) {
      if (payload.mimeType === 'text/html') {
        html = Buffer.from(payload.body.data, 'base64').toString('utf8');
      } else {
        plain = Buffer.from(payload.body.data, 'base64').toString('utf8');
      }
    }

    return { plain, html };
  }

  /**
   * Synchronize Gmail messages
   */
  async sync(accountId, maxMessages = 100) {
    const jobId = await syncManager.createJob(accountId, 'gmail', 'manual');
    let processed = 0;
    let failed = 0;

    try {
      const gmail = await this.getAuthenticatedClient(accountId);
      await syncManager.log(jobId, 'gmail', 'info', 'Fetching message list from Gmail...');

      // Get profile to check historyId
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const currentHistoryId = profile.data.historyId;

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxMessages
      });

      const messageItems = listRes.data.messages || [];
      const total = messageItems.length;
      await syncManager.log(jobId, 'gmail', 'info', `Found ${total} messages to synchronize.`);

      for (let i = 0; i < total; i++) {
        const item = messageItems[i];
        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: item.id,
            format: 'full'
          });

          const msg = msgRes.data;
          const headers = msg.payload?.headers || [];
          const from = this.getHeader(headers, 'From');
          const to = this.getHeader(headers, 'To');
          const cc = this.getHeader(headers, 'Cc');
          const bcc = this.getHeader(headers, 'Bcc');
          const subject = this.getHeader(headers, 'Subject') || '(No Subject)';
          const dateStr = this.getHeader(headers, 'Date');
          const { name: senderName, email: senderEmail } = this.parseSender(from);
          const { plain: bodyPlain, html: bodyHtml } = this.extractBody(msg.payload || {});

          // Ingest email record
          const [existing] = await query(
            `SELECT id FROM emails WHERE connected_account_id = ? AND message_id = ?`,
            [accountId, msg.id]
          );

          let emailDbId;
          if (existing) {
            emailDbId = existing.id;
            await query(
              `UPDATE emails 
               SET thread_id = ?, history_id = ?, sender_name = ?, sender_email = ?, recipient_to = ?, recipient_cc = ?, recipient_bcc = ?, subject = ?, snippet = ?, body_plain = ?, body_html = ?, internal_date = ?, labels_json = ?
               WHERE id = ?`,
              [
                msg.threadId,
                msg.historyId,
                senderName,
                senderEmail,
                to,
                cc,
                bcc,
                subject,
                msg.snippet,
                bodyPlain,
                bodyHtml,
                msg.internalDate,
                JSON.stringify(msg.labelIds || []),
                emailDbId
              ]
            );
          } else {
            const insertRes = await query(
              `INSERT INTO emails (
                connected_account_id, thread_id, message_id, history_id,
                sender_name, sender_email, recipient_to, recipient_cc, recipient_bcc,
                subject, snippet, body_plain, body_html, internal_date, labels_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                accountId,
                msg.threadId,
                msg.id,
                msg.historyId,
                senderName,
                senderEmail,
                to,
                cc,
                bcc,
                subject,
                msg.snippet,
                bodyPlain,
                bodyHtml,
                msg.internalDate,
                JSON.stringify(msg.labelIds || [])
              ]
            );
            emailDbId = insertRes.insertId;
          }

          // Ingest contact
          if (senderEmail) {
            await query(
              `INSERT INTO contacts (user_id, source_platform, external_id, name, display_name, email)
               VALUES (1, 'gmail', ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), display_name = VALUES(display_name)`,
              [senderEmail, senderName, senderName, senderEmail]
            );
          }

          // Handle attachments if present
          if (msg.payload && msg.payload.parts) {
            for (const part of msg.payload.parts) {
              if (part.filename && part.body && part.body.attachmentId) {
                try {
                  const attRes = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId: msg.id,
                    id: part.body.attachmentId
                  });

                  if (attRes.data && attRes.data.data) {
                    const fileBuffer = Buffer.from(attRes.data.data, 'base64');
                    const saved = storageManager.saveFile(
                      'gmail',
                      String(emailDbId),
                      part.filename,
                      fileBuffer
                    );

                    await query(
                      `INSERT INTO email_attachments (email_id, attachment_id, original_filename, mime_type, file_size, file_path, sha256_hash)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [
                        emailDbId,
                        part.body.attachmentId,
                        part.filename,
                        part.mimeType,
                        saved.size,
                        saved.relativePath,
                        saved.hash
                      ]
                    );

                    // Index document chunks
                    await documentExtractor.processAndIndexDocument({
                      sourcePlatform: 'gmail',
                      originalRecordId: emailDbId,
                      fileId: part.body.attachmentId,
                      fileName: part.filename,
                      senderOrOwner: `${senderName} <${senderEmail}>`,
                      timestamp: msg.internalDate ? parseInt(msg.internalDate, 10) : Date.now(),
                      buffer: fileBuffer,
                      mimeType: part.mimeType
                    });
                  }
                } catch (attErr) {
                  console.warn(`[Gmail] Attachment download error:`, attErr.message);
                }
              }
            }
          }

          processed++;
        } catch (err) {
          failed++;
          console.warn(`[Gmail] Error ingesting message ${item.id}:`, err.message);
        }

        const pct = Math.round(((i + 1) / total) * 100);
        await syncManager.updateProgress(jobId, 'gmail', pct, processed, failed, currentHistoryId);
      }

      await syncManager.completeJob(jobId, accountId, 'gmail', processed, currentHistoryId);
      return { success: true, processed, failed };
    } catch (error) {
      await syncManager.failJob(jobId, accountId, 'gmail', error.message);
      throw error;
    }
  }

  async disconnect(accountId) {
    await query(
      `UPDATE connected_accounts SET status = 'disconnected', credentials_encrypted = NULL WHERE id = ? AND platform = 'gmail'`,
      [accountId]
    );
    await query(`DELETE FROM connector_sessions WHERE connected_account_id = ?`, [accountId]);
    return { success: true };
  }
}

export const gmailConnector = new GmailConnector();
export default gmailConnector;
