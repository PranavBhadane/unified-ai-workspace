import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import config from '../../config/env.js';
import { query } from '../../config/db.js';
import syncManager from '../../services/sync/syncManager.js';
import storageManager from '../../services/storage/storageManager.js';
import documentExtractor from '../../services/documents/documentExtractor.js';

class WhatsAppConnector {
  constructor() {
    this.sock = null;
    this.qrCodeDataUrl = null;
    this.connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'qr_ready'
    this.authPath = path.join(config.storage.rootPath, 'whatsapp', 'auth_info');
    this.ensureAuthDir();
  }

  ensureAuthDir() {
    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }
  }

  getStatus() {
    return {
      status: this.connectionState,
      hasQr: !!this.qrCodeDataUrl,
      qrCode: this.qrCodeDataUrl
    };
  }

  async initializeSocket(userId = 1) {
    if (this.sock) {
      return;
    }

    this.connectionState = 'connecting';
    syncManager.broadcast('whatsapp:status', { status: 'connecting' });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
      const { version } = await fetchLatestBaileysVersion();

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
        browser: ['Unified AI Workspace', 'Chrome', '1.0.0']
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            this.connectionState = 'qr_ready';
            syncManager.broadcast('whatsapp:qr', { qr: this.qrCodeDataUrl });
            syncManager.broadcast('whatsapp:status', { status: 'qr_ready' });
          } catch (e) {
            console.error('[WhatsApp] QR generation error:', e);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.connectionState = 'disconnected';
          this.qrCodeDataUrl = null;
          syncManager.broadcast('whatsapp:status', { status: 'disconnected', reason: lastDisconnect?.error?.message });

          this.sock = null;
          if (shouldReconnect) {
            console.log('[WhatsApp] Reconnecting session...');
            setTimeout(() => this.initializeSocket(userId), 3000);
          } else {
            console.log('[WhatsApp] Logged out from WhatsApp.');
            await query(
              `UPDATE connected_accounts SET status = 'disconnected' WHERE platform = 'whatsapp'`
            );
          }
        } else if (connection === 'open') {
          this.connectionState = 'connected';
          this.qrCodeDataUrl = null;

          const userJid = this.sock.user?.id || '';
          const userName = this.sock.user?.name || userJid.split(':')[0] || 'WhatsApp User';
          const phoneNumber = userJid.split(':')[0] || '';

          // Upsert connected account
          const [existing] = await query(
            `SELECT id FROM connected_accounts WHERE user_id = ? AND platform = 'whatsapp' AND account_identifier = ?`,
            [userId, phoneNumber]
          );

          let accountId;
          if (existing) {
            accountId = existing.id;
            await query(
              `UPDATE connected_accounts SET status = 'connected', account_name = ?, last_sync_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [userName, accountId]
            );
          } else {
            const ins = await query(
              `INSERT INTO connected_accounts (user_id, platform, account_identifier, account_name, status)
               VALUES (?, 'whatsapp', ?, ?, 'connected')`,
              [userId, phoneNumber, userName]
            );
            accountId = ins.insertId;
          }

          syncManager.broadcast('whatsapp:status', {
            status: 'connected',
            user: { jid: userJid, name: userName, phone: phoneNumber }
          });
          console.log(`[WhatsApp] Successfully connected as ${userName} (${phoneNumber})`);
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
          if (!msg.message) continue;
          await this.processMessage(msg);
        }
      });

      // Handle contacts
      this.sock.ev.on('contacts.upsert', async (contacts) => {
        for (const c of contacts) {
          if (!c.id) continue;
          const phone = c.id.split('@')[0];
          const name = c.name || c.notify || phone;
          await query(
            `INSERT INTO wa_contacts (connected_account_id, jid, name, notify_name, phone_number)
             SELECT id, ?, ?, ?, ? FROM connected_accounts WHERE platform = 'whatsapp' LIMIT 1
             ON DUPLICATE KEY UPDATE name = VALUES(name), notify_name = VALUES(notify_name)`,
            [c.id, name, c.notify || null, phone]
          );
          await query(
            `INSERT INTO contacts (user_id, source_platform, external_id, name, display_name, phone_number)
             VALUES (1, 'whatsapp', ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), display_name = VALUES(display_name), phone_number = VALUES(phone_number)`,
            [c.id, name, name, phone]
          );
        }
      });

      // Handle group updates
      this.sock.ev.on('groups.upsert', async (groups) => {
        for (const g of groups) {
          await query(
            `INSERT INTO wa_groups (connected_account_id, group_jid, subject, owner_jid, creation_timestamp, description)
             SELECT id, ?, ?, ?, ?, ? FROM connected_accounts WHERE platform = 'whatsapp' LIMIT 1
             ON DUPLICATE KEY UPDATE subject = VALUES(subject), description = VALUES(description)`,
            [g.id, g.subject, g.owner || null, g.creation ? g.creation * 1000 : null, g.desc || null]
          );
        }
      });

    } catch (error) {
      console.error('[WhatsApp] Initialization error:', error);
      this.connectionState = 'disconnected';
    }
  }

  async processMessage(msg) {
    try {
      const chatJid = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe || false;
      const messageId = msg.key.id;
      const senderJid = msg.key.participant || (isFromMe ? this.sock.user?.id : chatJid);
      const timestamp = (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now());

      let textContent = '';
      let caption = '';
      let messageType = 'text';
      let hasMedia = false;
      let mediaMime = null;
      let mediaSize = null;
      let savedLocalPath = null;

      const m = msg.message;
      if (m.conversation) {
        textContent = m.conversation;
      } else if (m.extendedTextMessage?.text) {
        textContent = m.extendedTextMessage.text;
      } else if (m.imageMessage) {
        messageType = 'image';
        hasMedia = true;
        caption = m.imageMessage.caption || '';
        mediaMime = m.imageMessage.mimetype;
        mediaSize = m.imageMessage.fileLength;
      } else if (m.videoMessage) {
        messageType = 'video';
        hasMedia = true;
        caption = m.videoMessage.caption || '';
        mediaMime = m.videoMessage.mimetype;
        mediaSize = m.videoMessage.fileLength;
      } else if (m.audioMessage) {
        messageType = 'audio';
        hasMedia = true;
        mediaMime = m.audioMessage.mimetype;
        mediaSize = m.audioMessage.fileLength;
      } else if (m.documentMessage) {
        messageType = 'document';
        hasMedia = true;
        caption = m.documentMessage.title || m.documentMessage.fileName || '';
        mediaMime = m.documentMessage.mimetype;
        mediaSize = m.documentMessage.fileLength;
      }

      // Download accessible media if document or image
      if (hasMedia && this.sock && (messageType === 'document' || messageType === 'image')) {
        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }), reuploadRequest: this.sock.updateMediaMessage }
          );

          if (buffer) {
            const date = new Date(timestamp);
            const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
            const ext = mediaMime ? `.${mediaMime.split('/')[1] || 'bin'}` : '.bin';
            const fileName = caption ? caption : `wa_${messageId}${ext}`;
            const saved = storageManager.saveFile(
              'whatsapp',
              `${chatJid.replace(/[^a-zA-Z0-9]/g, '_')}/${yearMonth}`,
              fileName,
              buffer
            );
            savedLocalPath = saved.relativePath;

            // Extract document text & chunk
            if (messageType === 'document') {
              await documentExtractor.processAndIndexDocument({
                sourcePlatform: 'whatsapp',
                originalRecordId: messageId,
                fileId: messageId,
                fileName,
                senderOrOwner: senderJid,
                timestamp: date,
                buffer,
                mimeType: mediaMime
              });
            }
          }
        } catch (mediaErr) {
          console.warn(`[WhatsApp] Failed to download media for message ${messageId}:`, mediaErr.message);
        }
      }

      // Ensure wa_chats entry
      await query(
        `INSERT INTO wa_chats (connected_account_id, jid, name, is_group, last_message_timestamp)
         SELECT id, ?, ?, ?, ? FROM connected_accounts WHERE platform = 'whatsapp' LIMIT 1
         ON DUPLICATE KEY UPDATE last_message_timestamp = VALUES(last_message_timestamp)`,
        [chatJid, msg.pushName || chatJid, chatJid.endsWith('@g.us'), timestamp]
      );

      // Insert message
      const [acc] = await query(`SELECT id FROM connected_accounts WHERE platform = 'whatsapp' LIMIT 1`);
      if (acc) {
        await query(
          `INSERT INTO wa_messages (
            connected_account_id, chat_jid, message_id, sender_jid, sender_name,
            timestamp, message_type, text_content, caption, has_media,
            media_path, media_mimetype, media_size, is_from_me, raw_data_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE text_content = VALUES(text_content), caption = VALUES(caption)`,
          [
            acc.id,
            chatJid,
            messageId,
            senderJid,
            msg.pushName || null,
            timestamp,
            messageType,
            textContent,
            caption,
            hasMedia,
            savedLocalPath,
            mediaMime,
            mediaSize ? Number(mediaSize) : null,
            isFromMe,
            JSON.stringify(msg)
          ]
        );
      }
    } catch (err) {
      console.error('[WhatsApp] Error processing message:', err);
    }
  }

  async disconnect() {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (e) {
        // ignore
      }
      this.sock.end(undefined);
      this.sock = null;
    }
    this.connectionState = 'disconnected';
    this.qrCodeDataUrl = null;

    // Remove local auth folder
    if (fs.existsSync(this.authPath)) {
      fs.rmSync(this.authPath, { recursive: true, force: true });
    }

    await query(`UPDATE connected_accounts SET status = 'disconnected' WHERE platform = 'whatsapp'`);
    syncManager.broadcast('whatsapp:status', { status: 'disconnected' });
    return { success: true };
  }
}

export const whatsappConnector = new WhatsAppConnector();
export default whatsappConnector;
