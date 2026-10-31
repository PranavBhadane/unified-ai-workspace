# Environment Inspection & Verification Report

**Date:** 2026-10-31  
**Host Machine:** NUAGE_LENOVO (Windows 11 / x64)  
**User:** `Nuage123`  
**Workspace:** `D:\Hackthone\unified-ai-workspace`

---

## 1. Verified Software Inventory

| Software | Status | Version | Path / Details |
| :--- | :--- | :--- | :--- |
| **Node.js** | Available | `v24.17.0` | `C:\Program Files\nodejs\node.exe` |
| **npm** | Available | `11.13.0` | `C:\Program Files\nodejs\npm.cmd` |
| **Git** | Available | `2.56.0.windows.4` | `C:\Users\Nuage123\AppData\Local\Programs\Git\cmd\git.exe` |
| **MySQL Server** | Running Service | `8.4.9 LTS` | Port 3306 (`MySQL Server 8.4` Windows Service) |
| **Database** | Created & Verified | `unified_ai_workspace` | UTF8MB4 Unicode CI, InnoDB Engine |
| **Memory (RAM)** | Verified | `14.86 GB` | Ample physical memory for indexing & connectors |
| **Disk Space** | Verified | Drive D: (Hackthone) | Dedicated storage partition for local file storage |

---

## 2. MySQL Connectivity Verification

- **Host:** `127.0.0.1` / `localhost`
- **Port:** `3306`
- **Database:** `unified_ai_workspace`
- **Root Account:** `root` (Local MySQL Administrator)
- **App User:** `root` or dedicated application user (Granted `ALL PRIVILEGES` on `unified_ai_workspace.*`)
- **Full-Text Search:** Supported natively on InnoDB engine tables with `ngram` / default tokenizer on `utf8mb4`.

---

## 3. Gemini AI Configuration Status

- **Gemini API Key:** Ready to be supplied in `backend/.env` or dynamically configured via the in-app Settings page (`POST /api/settings`).
- **SDK:** Official `@google/genai` (GoogleGenAI).
- **Default Models:** `gemini-2.5-flash` / `gemini-2.0-flash` with dynamic model availability probing.

---

## 4. External Connectors Verification Plan

- **WhatsApp:** `@whiskeysockets/baileys` linked-device session with QR streaming and persistent credentials.
- **Gmail:** Official Google APIs (`googleapis`), OAuth 2.0 with `gmail.readonly` scope.
- **Google Drive:** Official Google APIs (`googleapis`), OAuth 2.0 with `drive.readonly` scope.
