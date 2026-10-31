# Google Drive Connector Documentation

**Library:** `googleapis`  
**API:** Google Drive API v3  
**OAuth Scope:** `https://www.googleapis.com/auth/drive.readonly`  
**Storage Path:** `storage/drive/{fileId}/`  

---

## 1. Overview

The Google Drive connector indexes files, folders, and documents from the user's personal Google Drive account. It supports both binary files (PDFs, Microsoft Office documents) and native Google Workspace files (Google Docs, Google Sheets).

---

## 2. Ingestion & Conversion Pipeline

1. **Folder & File Enumeration:**
   - Queries `drive.files.list` with `q: 'trashed = false'`.
   - Records directory structures into `drive_folders`.
   - Saves file metadata (name, mimeType, size, createdTime, modifiedTime, owners, webViewLink) into `drive_files`.

2. **Native Google Docs & Sheets Conversion:**
   - Native Google Docs (`application/vnd.google-apps.document`) are exported to UTF-8 plain text using `drive.files.export({ mimeType: 'text/plain' })`.
   - Native Google Sheets (`application/vnd.google-apps.spreadsheet`) are exported to CSV using `drive.files.export({ mimeType: 'text/csv' })`.

3. **Binary File Ingestion:**
   - PDFs, DOCX, XLSX, and TXT files are downloaded in binary streams to `storage/drive/{fileId}/`.
   - Calculates SHA-256 hash to prevent duplicate downloads.

4. **Text Extraction & Chunking:**
   - Uses `documentExtractor` to parse text and split into 1,000-character overlapping chunks.
   - Saves full text into `drive_file_contents` and chunks into `document_chunks`.
   - Preserves direct web links (`webViewLink`) so the user can open original files in Google Drive with one click.
