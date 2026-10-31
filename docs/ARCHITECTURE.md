# Unified AI Workspace: System Architecture

**Document Version:** 1.0.0  
**Application Architecture:** Local-First Full-Stack Personal Intelligence Workspace  
**Host Platform:** Windows 11 / 10 x64  

---

## 1. High-Level Architecture

The Unified AI Workspace is designed from the ground up as a **privacy-respecting, local-first intelligence hub**. All communications, emails, contacts, and files from WhatsApp, Gmail, and Google Drive are synchronized to local storage and a local MySQL database. AI queries are processed through controlled Google Gemini function calling where only relevant, locally matched context is submitted to the LLM.

```
+-------------------------------------------------------------------------------+
|                             REACT 18 FRONTEND (VITE)                          |
|  Dashboard  |  AI Assistant  |  Connectors  |  Clients  |  Docs  |  Settings  |
+---------------------------------------+---------------------------------------+
                                        | HTTP REST & WebSocket (Socket.IO)
+---------------------------------------v---------------------------------------+
|                                EXPRESS.JS BACKEND                             |
|  Controllers  |  Auth & Sessions  |  Sync Manager  |  Entity Resolution Svc  |
+---------+-------------------+--------------------+--------------------+-------+
          |                   |                    |                    |
+---------v--------+ +--------v--------+ +---------v---------+ +--------v-------+
|    WHATSAPP      | |      GMAIL      | |   GOOGLE DRIVE    | |   GEMINI AI    |
|    Baileys       | | Google APIs v1  | | Google Drive API  | |  @google/genai |
|  Multi-file Auth | | OAuth 2.0 (RO)  | | OAuth 2.0 (RO)    | |  18 Backend    |
|  QR Streaming    | | Incremental     | | Export & Content  | |  Search Tools  |
+---------+--------+ +--------+--------+ +---------+---------+ +--------+-------+
          |                   |                    |                    |
+---------v-------------------v--------------------v--------------------v-------+
|                             LOCAL STORAGE SUBSYSTEM                           |
|  storage/whatsapp/  |  storage/gmail/  |  storage/drive/  |  storage/extracted|
|               SHA-256 Deduplication & Document Text Chunks                   |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                           LOCAL MYSQL 8.4 LTS DATABASE                        |
|  28 Normalized Tables  |  InnoDB Storage Engine  |  MySQL FULLTEXT Indexes    |
+-------------------------------------------------------------------------------+
```

---

## 2. Component Subsystems

### A. Frontend Layer
- **Framework:** React 18 with Vite build system and Tailwind CSS.
- **Component Design:** Clean SaaS design language with dark/light themes, Lucide icons, responsive sidebar, KPI dashboards, and interactive chat interface.
- **Real-Time Client:** Socket.IO client subscribed to sync progress, live logs, WhatsApp QR generation, and AI search step streaming.

### B. Backend Layer
- **Runtime:** Node.js v24.17.0 with ES modules.
- **Server:** Express.js REST API with input validation and error handling.
- **Real-Time Gateway:** Socket.IO server mounted on the Node HTTP server.
- **Credential Security:** AES-256-GCM symmetric encryption for OAuth tokens and session data at rest using `CREDENTIAL_ENCRYPTION_KEY`.

### C. Connectors Layer
- **WhatsApp Connector:** Built on `@whiskeysockets/baileys`. Listens to WhatsApp multi-device WebSocket events, streams QR codes as Base64 data URLs, and decrypts media messages locally.
- **Gmail Connector:** Built on `googleapis`. Read-only OAuth 2.0 (`gmail.readonly`). Retrieves threads, MIME multipart bodies, and attachments.
- **Google Drive Connector:** Built on `googleapis`. Read-only OAuth 2.0 (`drive.readonly`). Downloads binary files (PDF, DOCX, XLSX, TXT) and exports native Google Docs/Sheets into plain text and CSV.

### D. Centralized Document Processor
- Ingests buffers from all three connectors.
- Detects MIME type and parses via `pdf-parse`, `mammoth`, `xlsx`, and native text readers.
- Chunks text into 1,000 character overlapping windows (200 char overlap) with estimated token counts and indexes into `document_chunks`.

### E. Entity Resolution Service
- Cross-platform identity resolution using phone normalization, email canonicalization, and alias matching.
- Assembles consolidated dossiers, chronological timelines, financial discussions, and pending commitments.

### F. Gemini AI Service
- Official `@google/genai` SDK using `GoogleGenAI`.
- Controlled function calling loop (18 declared tools).
- Safe iteration limits, result truncation, error boundaries, and source citation logging.
