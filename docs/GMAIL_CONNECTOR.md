# Gmail Connector Documentation

**Library:** `googleapis`  
**API:** Official Gmail API v1  
**OAuth Scope:** `https://www.googleapis.com/auth/gmail.readonly`  
**Storage Path:** `storage/gmail/{emailId}/`  

---

## 1. Overview

The Gmail connector provides secure, read-only synchronization of emails, message threads, contacts, and attachments from Google Workspace or personal Gmail accounts.

---

## 2. Google OAuth 2.0 Flow

1. The user creates a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enables the **Gmail API**.
3. Creates OAuth 2.0 credentials (Web Application):
   - **Authorized redirect URIs:** `http://localhost:5000/api/connections/google/callback`
4. Adds `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `backend/.env`.
5. In the app, clicking **Connect Gmail** redirects to Google's consent screen.
6. The user grants read-only consent.
7. The authorization code is received at `/api/connections/google/callback`, exchanged for access & refresh tokens, encrypted with AES-256-GCM, and stored in `connected_accounts`.

---

## 3. Synchronization Pipeline

- **Message Listing:** Paginates through `gmail.users.messages.list`.
- **Parsing:**
  - Headers: `From`, `To`, `Cc`, `Bcc`, `Subject`, `Date`.
  - Body: Decodes Base64 multipart `text/plain` and `text/html`.
  - Attachments: Downloads PDFs, DOCX, XLSX attachments to `storage/gmail/{emailId}/`.
- **Indexing:**
  - Inserts email records into `emails` with MySQL FULLTEXT index on `(subject, body_plain)`.
  - Extracts text from attachments and chunks them into `document_chunks`.
  - Saves contacts into `contacts`.
- **Incremental Sync:** Tracks `historyId` to ingest only new and updated messages since the last checkpoint.
