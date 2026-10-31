# WhatsApp Connector Documentation

**Library:** `@whiskeysockets/baileys`  
**Connection Protocol:** Multi-Device WhatsApp Web WebSocket protocol  
**Session Storage Path:** `storage/whatsapp/auth_info/`  

---

## 1. Overview

The WhatsApp connector establishes an authentic multi-device session with the user's personal WhatsApp account. The server acts as a registered linked device (named `Unified AI Workspace` in WhatsApp settings).

---

## 2. Authentication Flow

1. The frontend triggers `POST /api/connections/whatsapp/connect` or opens the **Connections** page.
2. The backend initializes `makeWASocket` with `useMultiFileAuthState(storage/whatsapp/auth_info)`.
3. When Baileys issues a QR string, `QRCode.toDataURL()` converts the raw string into a standard PNG data URL.
4. The QR data URL is broadcast via Socket.IO (`whatsapp:qr`) and accessible via `GET /api/whatsapp/qr`.
5. The user opens WhatsApp on their phone -> **Linked Devices** -> **Link a Device** and scans the QR code on screen.
6. WhatsApp establishes a cryptographic handshake. The credentials are saved to `storage/whatsapp/auth_info/creds.json`.
7. The connector state transitions to `connected`. The user's JID, name, and phone number are recorded into `connected_accounts`.

---

## 3. Real-Time & Historical Event Handling

The connector attaches to the following Baileys event emitters:
- **`connection.update`**: Tracks `qr`, `open`, `close`, `lastDisconnect`. Handles auto-reconnect unless explicitly logged out.
- **`messages.upsert`**: Ingests incoming and outgoing messages:
  - Text messages (`conversation`, `extendedTextMessage`).
  - Media messages: downloads binary attachments (images, audio notes, PDF documents) using `downloadMediaMessage`.
  - Saves attachments to `storage/whatsapp/{chatJid}/{year}/{month}/`.
  - Indexes document chunks into `document_chunks`.
- **`contacts.upsert`**: Synchronizes contact phone numbers and display names into `wa_contacts` and `contacts`.
- **`groups.upsert`**: Synchronizes group subjects and descriptions into `wa_groups`.

---

## 4. Disconnect & Security

- Clicking **Disconnect** in the UI calls `whatsappConnector.disconnect()`.
- The socket cleanly logs out and closes the WebSocket connection.
- Local session state files in `storage/whatsapp/auth_info/` are wiped securely.
- Status in `connected_accounts` is updated to `disconnected`.
