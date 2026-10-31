# API Documentation

**Base URL:** `http://127.0.0.1:5000/api`  
**Authentication:** JWT Bearer token or cookie (`Authorization: Bearer <token>`). In single-user local mode, default user is automatically resolved when no token is supplied.

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
- **Body:** `{ "username": "admin", "password": "<password>" }`
- **Response:** `{ "success": true, "token": "...", "user": { ... } }`

### `POST /api/auth/logout`
- **Response:** `{ "success": true, "message": "Logged out successfully" }`

### `GET /api/auth/me`
- **Response:** `{ "success": true, "user": { ... } }`

---

## 2. Connector Endpoints

### `GET /api/connections`
- **Description:** Returns connection status for WhatsApp, Gmail, and Google Drive.
- **Response:**
  ```json
  {
    "success": true,
    "connectors": [
      { "platform": "whatsapp", "status": "connected", "account": { ... } },
      { "platform": "gmail", "status": "disconnected", "account": null },
      { "platform": "drive", "status": "disconnected", "account": null }
    ]
  }
  ```

### `POST /api/connections/:platform/connect`
- **Params:** `platform` (`whatsapp`, `gmail`, `drive`)
- **Response:**
  - WhatsApp: `{ "success": true, "status": { "status": "qr_ready", "hasQr": true } }`
  - Gmail / Drive: `{ "success": true, "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..." }`

### `DELETE /api/connections/:platform`
- **Description:** Disconnects account and invalidates session credentials.

---

## 3. WhatsApp Endpoints

### `GET /api/whatsapp/qr`
- **Response:** `{ "success": true, "qr": "data:image/png;base64,...", "status": "qr_ready" }`

### `GET /api/whatsapp/chats?limit=50&q=`
- **Response:** `{ "success": true, "chats": [ ... ] }`

### `GET /api/whatsapp/messages?chatJid=...&limit=50`
- **Response:** `{ "success": true, "messages": [ ... ] }`

---

## 4. Gmail Endpoints

### `GET /api/gmail/messages?limit=50&q=`
- **Response:** `{ "success": true, "emails": [ ... ] }`

### `GET /api/gmail/threads?limit=50`
- **Response:** `{ "success": true, "threads": [ ... ] }`

### `GET /api/gmail/search?q=invoice`
- **Response:** `{ "success": true, "results": [ ... ] }`

---

## 5. Google Drive Endpoints

### `GET /api/drive/files?limit=50&q=&mimeType=`
- **Response:** `{ "success": true, "files": [ ... ] }`

### `GET /api/drive/search?q=agreement`
- **Response:** `{ "success": true, "results": [ ... ] }`

---

## 6. AI Assistant Endpoints

### `POST /api/ai/chat`
- **Body:**
  ```json
  {
    "message": "Give me all details about client XYZ Enterprises",
    "conversationId": 1,
    "platforms": ["whatsapp", "gmail", "drive"]
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "conversationId": 1,
    "reply": "### Client Dossier: XYZ Enterprises\n...",
    "sources": [
      { "sourcePlatform": "gmail", "recordId": "12", "title": "Rental Quote", "snippet": "..." }
    ],
    "tokenUsage": { "totalTokenCount": 850 }
  }
  ```

### `GET /api/ai/conversations`
- **Response:** `{ "success": true, "conversations": [ ... ] }`

### `POST /api/ai/test-connection`
- **Response:** `{ "success": true, "model": "gemini-2.5-flash", "reply": "OK" }`

---

## 7. Clients & Entities Endpoints

### `GET /api/entities?q=`
- **Response:** `{ "success": true, "entities": [ ... ] }`

### `GET /api/entities/:id`
- **Response:** `{ "success": true, "profile": { "entity": { ... }, "whatsappMessages": [], "emails": [], "driveFiles": [], "financialHighlights": [] } }`

### `GET /api/entities/:id/timeline`
- **Response:** `{ "success": true, "timeline": { "totalEvents": 14, "events": [ ... ] } }`

### `POST /api/entities/correlate`
- **Description:** Triggers automated cross-platform resolution.

---

## 8. Synchronization Endpoints

### `GET /api/sync/status`
- **Response:** `{ "success": true, "status": { "activeJobs": [], "runningDetails": [] } }`

### `POST /api/sync/start`
- **Body:** `{ "platform": "gmail" }`
- **Response:** `{ "success": true, "message": "Gmail synchronization started in background." }`

### `POST /api/sync/stop`
- **Body:** `{ "platform": "gmail" }`
- **Response:** `{ "success": true, "cancelled": true }`

---

## 9. Settings Endpoints

### `GET /api/settings`
- **Response:** `{ "success": true, "settings": { ... } }`

### `POST /api/settings`
- **Body:** `{ "geminiApiKey": "...", "geminiModel": "gemini-2.5-flash", "allowedSources": ["whatsapp", "gmail", "drive"] }`
- **Response:** `{ "success": true, "message": "Settings updated successfully" }`
