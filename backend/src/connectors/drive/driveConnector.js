import { google } from 'googleapis';
import config from '../../config/env.js';
import { query } from '../../config/db.js';
import { encryptCredential, decryptCredential } from '../../utils/crypto.js';
import syncManager from '../../services/sync/syncManager.js';
import storageManager from '../../services/storage/storageManager.js';
import documentExtractor from '../../services/documents/documentExtractor.js';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

class DriveConnector {
  getOAuth2Client() {
    return new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  getAuthUrl(state = 'drive') {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new Error('Google OAuth Client ID and Secret are not configured. Please set them in Settings or .env.');
    }
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DRIVE_SCOPES,
      state
    });
  }

  async handleCallback(code, userId = 1) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    const name = userInfo.data.name || email;

    const encryptedTokens = encryptCredential(tokens);

    const existing = await query(
      `SELECT id FROM connected_accounts WHERE user_id = ? AND platform = 'drive' AND account_identifier = ?`,
      [userId, email]
    );

    let accountId;
    if (existing.length > 0) {
      accountId = existing[0].id;
      await query(
        `UPDATE connected_accounts 
         SET status = 'connected', account_name = ?, credentials_encrypted = ?, scopes = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, encryptedTokens, JSON.stringify(DRIVE_SCOPES), JSON.stringify(userInfo.data), accountId]
      );
    } else {
      const res = await query(
        `INSERT INTO connected_accounts (user_id, platform, account_identifier, account_name, status, scopes, credentials_encrypted, metadata_json)
         VALUES (?, 'drive', ?, ?, 'connected', ?, ?, ?)`,
        [userId, email, name, JSON.stringify(DRIVE_SCOPES), encryptedTokens, JSON.stringify(userInfo.data)]
      );
      accountId = res.insertId;
    }

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
      `SELECT credentials_encrypted FROM connected_accounts WHERE id = ? AND platform = 'drive'`,
      [accountId]
    );
    if (!acc || !acc.credentials_encrypted) {
      throw new Error(`Google Drive account #${accountId} credentials not found.`);
    }

    const tokens = decryptCredential(acc.credentials_encrypted);
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    oauth2Client.on('tokens', async (newTokens) => {
      const updated = { ...tokens, ...newTokens };
      const encrypted = encryptCredential(updated);
      await query(
        `UPDATE connected_accounts SET credentials_encrypted = ? WHERE id = ?`,
        [encrypted, accountId]
      );
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Synchronize Drive files and contents
   */
  async sync(accountId, maxFiles = 100) {
    const jobId = await syncManager.createJob(accountId, 'drive', 'manual');
    let processed = 0;
    let failed = 0;

    try {
      const drive = await this.getAuthenticatedClient(accountId);
      await syncManager.log(jobId, 'drive', 'info', 'Listing accessible Google Drive files and folders...');

      // Fetch files list
      const listRes = await drive.files.list({
        pageSize: maxFiles,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, owners, webViewLink, webContentLink, iconLink, md5Checksum, trashed)',
        q: 'trashed = false'
      });

      const files = listRes.data.files || [];
      const total = files.length;
      await syncManager.log(jobId, 'drive', 'info', `Discovered ${total} files and folders to process.`);

      for (let i = 0; i < total; i++) {
        const file = files[i];
        try {
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
          const parentId = file.parents && file.parents.length > 0 ? file.parents[0] : null;
          const ownerName = file.owners && file.owners.length > 0 ? file.owners[0].displayName : '';

          if (isFolder) {
            await query(
              `INSERT INTO drive_folders (connected_account_id, folder_id, name, parent_id, web_view_link)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), parent_id = VALUES(parent_id), web_view_link = VALUES(web_view_link)`,
              [accountId, file.id, file.name, parentId, file.webViewLink || null]
            );
          } else {
            // File processing
            let fileBuffer = null;
            let downloadStatus = 'pending';

            // Check if exportable Google Doc/Sheet
            if (file.mimeType === 'application/vnd.google-apps.document') {
              try {
                const expRes = await drive.files.export({
                  fileId: file.id,
                  mimeType: 'text/plain'
                });
                fileBuffer = Buffer.from(typeof expRes.data === 'string' ? expRes.data : JSON.stringify(expRes.data), 'utf8');
                downloadStatus = 'downloaded';
              } catch (e) {
                console.warn(`[Drive] Export failed for Doc ${file.id}:`, e.message);
              }
            } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
              try {
                const expRes = await drive.files.export({
                  fileId: file.id,
                  mimeType: 'text/csv'
                });
                fileBuffer = Buffer.from(typeof expRes.data === 'string' ? expRes.data : JSON.stringify(expRes.data), 'utf8');
                downloadStatus = 'downloaded';
              } catch (e) {
                console.warn(`[Drive] Export failed for Sheet ${file.id}:`, e.message);
              }
            } else {
              // Standard binary file download for PDFs, Office documents, text
              const supportedTypes = [
                'pdf', 'word', 'sheet', 'presentation', 'excel', 'csv', 'text', 'plain', 'json'
              ];
              const isSupported = supportedTypes.some(t => file.mimeType?.toLowerCase().includes(t));

              if (isSupported && (!file.size || parseInt(file.size, 10) < 25 * 1024 * 1024)) { // Up to 25MB
                try {
                  const mediaRes = await drive.files.get(
                    { fileId: file.id, alt: 'media' },
                    { responseType: 'arraybuffer' }
                  );
                  fileBuffer = Buffer.from(mediaRes.data);
                  downloadStatus = 'downloaded';
                } catch (e) {
                  console.warn(`[Drive] Binary download failed for ${file.id}:`, e.message);
                  downloadStatus = 'failed';
                }
              } else {
                downloadStatus = isSupported ? 'pending' : 'unsupported';
              }
            }

            let localPath = null;
            let shaHash = null;

            if (fileBuffer) {
              const saved = storageManager.saveFile(
                'drive',
                file.id,
                file.name,
                fileBuffer
              );
              localPath = saved.relativePath;
              shaHash = saved.hash;
            }

            // Upsert into drive_files
            const [existing] = await query(
              `SELECT id FROM drive_files WHERE connected_account_id = ? AND file_id = ?`,
              [accountId, file.id]
            );

            let driveDbId;
            if (existing) {
              driveDbId = existing.id;
              await query(
                `UPDATE drive_files 
                 SET name = ?, mime_type = ?, size_bytes = ?, parent_id = ?, web_view_link = ?, web_content_link = ?,
                     icon_link = ?, md5_checksum = ?, sha256_hash = ?, drive_created_time = ?, drive_modified_time = ?,
                     owners_json = ?, is_trashed = ?, local_file_path = ?, download_status = ?
                 WHERE id = ?`,
                [
                  file.name,
                  file.mimeType,
                  file.size ? parseInt(file.size, 10) : (fileBuffer ? fileBuffer.length : 0),
                  parentId,
                  file.webViewLink,
                  file.webContentLink,
                  file.iconLink,
                  file.md5Checksum,
                  shaHash,
                  file.createdTime ? new Date(file.createdTime) : null,
                  file.modifiedTime ? new Date(file.modifiedTime) : null,
                  JSON.stringify(file.owners || []),
                  file.trashed || false,
                  localPath,
                  downloadStatus,
                  driveDbId
                ]
              );
            } else {
              const ins = await query(
                `INSERT INTO drive_files (
                  connected_account_id, file_id, name, mime_type, size_bytes, parent_id,
                  web_view_link, web_content_link, icon_link, md5_checksum, sha256_hash,
                  drive_created_time, drive_modified_time, owners_json, is_trashed,
                  local_file_path, download_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  accountId,
                  file.id,
                  file.name,
                  file.mimeType,
                  file.size ? parseInt(file.size, 10) : (fileBuffer ? fileBuffer.length : 0),
                  parentId,
                  file.webViewLink,
                  file.webContentLink,
                  file.iconLink,
                  file.md5Checksum,
                  shaHash,
                  file.createdTime ? new Date(file.createdTime) : null,
                  file.modifiedTime ? new Date(file.modifiedTime) : null,
                  JSON.stringify(file.owners || []),
                  file.trashed || false,
                  localPath,
                  downloadStatus
                ]
              );
              driveDbId = ins.insertId;
            }

            // Extract text and chunk if fileBuffer was downloaded
            if (fileBuffer) {
              const { extractedText } = await documentExtractor.processAndIndexDocument({
                sourcePlatform: 'drive',
                originalRecordId: driveDbId,
                fileId: file.id,
                fileName: file.name,
                senderOrOwner: ownerName,
                timestamp: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
                buffer: fileBuffer,
                mimeType: file.mimeType
              });

              if (extractedText) {
                await query(
                  `INSERT INTO drive_file_contents (file_id, raw_text)
                   VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE raw_text = VALUES(raw_text), extracted_at = CURRENT_TIMESTAMP`,
                  [driveDbId, extractedText]
                );
              }
            }
          }

          processed++;
        } catch (err) {
          failed++;
          console.warn(`[Drive] Error ingesting file ${file.id}:`, err.message);
        }

        const pct = Math.round(((i + 1) / total) * 100);
        await syncManager.updateProgress(jobId, 'drive', pct, processed, failed);
      }

      await syncManager.completeJob(jobId, accountId, 'drive', processed);
      return { success: true, processed, failed };
    } catch (error) {
      await syncManager.failJob(jobId, accountId, 'drive', error.message);
      throw error;
    }
  }

  async disconnect(accountId) {
    await query(
      `UPDATE connected_accounts SET status = 'disconnected', credentials_encrypted = NULL WHERE id = ? AND platform = 'drive'`,
      [accountId]
    );
    await query(`DELETE FROM connector_sessions WHERE connected_account_id = ?`, [accountId]);
    return { success: true };
  }
}

export const driveConnector = new DriveConnector();
export default driveConnector;
