# Unified AI Workspace — User Guide

Welcome to **Unified AI Workspace**, your local-first personal intelligence assistant for **WhatsApp**, **Gmail**, and **Google Drive**.

This guide covers everything you need to know to configure, synchronize, search, and generate actionable business intelligence from your communication and document archives.

---

## Table of Contents

1. [First-Time Setup & Onboarding](#1-first-time-setup--onboarding)
2. [AI Provider Configuration](#2-ai-provider-configuration)
3. [AI Assistant Tutorial](#3-ai-assistant-tutorial)
4. [WhatsApp Integration Walkthrough](#4-whatsapp-integration-walkthrough)
5. [Gmail Integration Walkthrough](#5-gmail-integration-walkthrough)
6. [Google Drive Integration Walkthrough](#6-google-drive-integration-walkthrough)
7. [Documents Explorer & File Viewer](#7-documents-explorer--file-viewer)
8. [Automated Business Reports](#8-automated-business-reports)
9. [Intelligent Dashboards & Analytics](#9-intelligent-dashboards--analytics)
10. [Settings, Synchronization & System Logs](#10-settings-synchronization--system-logs)

---

## 1. First-Time Setup & Onboarding

When you first launch Unified AI Workspace (`http://localhost:5173`):
1. **Welcome Screen:** You will arrive at the executive dashboard. In a fresh installation, all metrics will start at zero.
2. **Setup Checklist:**
   - [ ] Configure at least one AI Provider (**Settings** tab).
   - [ ] Connect your WhatsApp account (**Connections** tab).
   - [ ] Authorize Google OAuth for Gmail and Drive (**Connections** tab).
   - [ ] Trigger an initial synchronization (**Synchronization** tab).

All user data is stored strictly on your local computer in MySQL and your local `storage/` directory.

---

## 2. AI Provider Configuration

Unified AI Workspace supports three major AI providers. You can configure one or all three:

### 2.1 Google Gemini (Recommended)
1. Navigate to **Settings** in the left sidebar.
2. Locate the **Google Gemini** card.
3. If you do not have an API key, visit [Google AI Studio](https://aistudio.google.com/) to create one for free.
4. Paste your API key into the input field. (The key will be masked for security).
5. Click **Test Connection**. A green badge will confirm `Connected`.
6. Select your preferred model from the dropdown:
   - `gemini-3.1-flash-lite` (Fastest, recommended for search & synthesis)
   - `gemini-2.5-flash` (Balanced speed and intelligence)
   - `gemini-2.5-pro` (Best for deep document analysis and complex comparisons)
7. Click **Save Configuration**.

### 2.2 OpenAI (ChatGPT)
1. Obtain an API key from [OpenAI Platform](https://platform.openai.com/api-keys).
2. In the **OpenAI / ChatGPT** card, paste your API key (starts with `sk-`).
3. Click **Test Connection**.
4. Select `gpt-4o` or `gpt-4o-mini`.
5. Click **Save Configuration**.

### 2.3 Anthropic Claude
1. Obtain an API key from [Anthropic Console](https://console.anthropic.com/).
2. In the **Anthropic Claude** card, paste your API key (starts with `sk-ant-`).
3. Click **Test Connection**.
4. Select `claude-3-5-sonnet-20241022` or `claude-3-opus-20240229`.
5. Click **Save Configuration**.

> [!NOTE]
> All API keys saved via the Settings interface are encrypted using AES-256-GCM before being stored in the database.

---

## 3. AI Assistant Tutorial

The **AI Assistant** is your natural language search and synthesis terminal.

### 3.1 Interface Features
- **Search Scope Filters:** Toggle the `WA` (WhatsApp), `Gmail`, and `Drive` pills at the bottom of the chat to restrict or broaden search boundaries.
- **Dynamic Model Selector:** Change the active AI model on the fly using the model badge at the top right of the chat window.
- **New Chat Button:** Click **+ New Chat** in the conversation sidebar to start a clean session.
- **Copy Response:** Click the **Copy** button beneath any assistant message to copy the markdown text.

### 3.2 Sample Queries

Try asking questions such as:

#### Client Dossiers & Relationships
> *"Give me all details and a complete summary of what I received from Imran."*  
> *"Create a chronological timeline of my interactions with Rahul over the last 30 days."*

#### Financial & Terms Extraction
> *"What payment amounts or invoices did we discuss in WhatsApp for the equipment rental?"*  
> *"Find all invoices from ABC Enterprises and summarize the amounts paid versus pending."*

#### Cross-Platform Document Cross-Referencing
> *"Find the rental agreement in Google Drive and compare the terms with our WhatsApp messages."*  
> *"Which commitments made to Rahul in Gmail have not yet been completed?"*

### 3.3 Understanding AI Responses
- **Tool Traces:** The assistant displays small status chips (e.g. `Searching WhatsApp...`, `Querying Drive...`) while retrieving facts.
- **Record Citations:** Responses cite original dates, senders, and file names so you can independently verify every fact.

---

## 4. WhatsApp Integration Walkthrough

Unified AI Workspace can pair directly with WhatsApp Web or connect to an external archive service.

### 4.1 Pairing via QR Code
1. Navigate to **Connections** in the sidebar.
2. Find the **WhatsApp** card and click **Connect / Show QR Code**.
3. Open WhatsApp on your smartphone:
   - **Android:** Tap the three dots (top right) > **Linked devices** > **Link a device**.
   - **iOS:** Tap **Settings** (bottom right) > **Linked Devices** > **Link a Device**.
4. Scan the QR code displayed on your computer monitor.
5. Within 5–10 seconds, the card will display a green `Active` status with your phone number.

### 4.2 Data Synchronized
- Direct chats and messages
- Group conversations and participant rosters
- Image and document attachments
- Timestamps and delivery statuses

> [!IMPORTANT]
> WhatsApp Web sessions remain active as long as your phone connects to the internet at least once every 14 days.

---

## 5. Gmail Integration Walkthrough

Synchronize your business emails without forwarding them to cloud servers.

### 5.1 Connecting Gmail
1. In **Connections**, click **Connect Gmail**.
2. A secure Google OAuth popup or redirect will ask you to sign in with your Google account.
3. Review the requested permissions:
   - `https://www.googleapis.com/auth/gmail.readonly` (Read-only access to messages and attachments).
4. Click **Allow**.
5. Once redirected back, the Gmail card will show `Active` with your email address.

### 5.2 Synchronization Details
- **Incremental Fetching:** Only new emails since the last sync are fetched.
- **Attachment Storage:** Invoices, PDF receipts, and spreadsheets are downloaded directly into `storage/gmail/`.
- **HTML Sanitization:** Emails are converted to clean, searchable text while preserving formatting.

---

## 6. Google Drive Integration Walkthrough

### 6.1 Connecting Google Drive
1. In **Connections**, click **Connect Google Drive**.
2. Grant read-only access (`https://www.googleapis.com/auth/drive.readonly`).
3. Once linked, click **Sync Now** to begin indexing.

### 6.2 Supported File Types & Extraction
- **Google Docs:** Exported automatically to formatted plain text.
- **Google Sheets:** Exported and parsed as structured tabular text.
- **PDF Documents:** Extracted using local text-extraction engines (`pdf-parse`).
- **Word Documents (`.docx`):** Extracted using `mammoth`.
- **Plain Text / Code (`.txt`, `.json`, `.csv`, `.md`):** Indexed verbatim.

---

## 7. Documents Explorer & File Viewer

Navigate to **Documents** in the sidebar to browse your indexed files.

### 7.1 Features
- **Filter by Type:** Filter documents by `PDF`, `DOCX`, `Spreadsheet`, or `Text`.
- **Full-Text In-Browser Search:** Search within the extracted text of any file.
- **Chunk Inspector:** View exactly how a file was split into searchable chunks for the AI assistant.
- **Preview Modal:** Click any document to read its extracted text in a clean reader view without needing external desktop software.

---

## 8. Automated Business Reports

Convert conversations and documents into structured business artifacts.

### 8.1 Available Report Types
1. **Client Executive Summary:** An executive-level briefing on a specific client or deal.
2. **Financial & Invoicing Audit:** Detailed breakdown of discussed rates, payments, and quotations.
3. **Risk & Commitment Review:** Summary of open deadlines, unfulfilled promises, and overdue items.
4. **Communication Timeline:** Chronological timeline across all channels.
5. **Operational Efficiency Report:** Message volumes, response times, and communication trends.

### 8.2 Generating & Exporting
1. Navigate to **Reports** in the sidebar.
2. Select your desired **Report Type**.
3. Select the target **Client / Entity** or choose **All Entities**.
4. Set the **Date Range**.
5. Click **Generate Report**.
6. Export the finalized report with one click in your preferred format:
   - **PDF:** Polished document with headers, tables, and page numbers.
   - **DOCX:** Editable Microsoft Word document.
   - **XLSX:** Multi-tab Microsoft Excel spreadsheet.
   - **CSV:** Tabular data for external analysis.

---

## 9. Intelligent Dashboards & Analytics

Navigate to **Dashboard** in the sidebar:
- **Telemetry Cards:** Total messages, emails, files, and identified contacts.
- **Communication Velocity:** Line chart showing daily message volumes.
- **Sentiment Breakdown:** Donut chart illustrating client sentiment across active threads.
- **Top Contacts:** Quick view of the most frequent communicators.

---

## 10. Settings, Synchronization & System Logs

### 10.1 Synchronization Manager
- Go to **Synchronization** to monitor active data pipelines.
- View real-time status of WhatsApp, Gmail, and Google Drive ingestion jobs.
- Trigger manual full or incremental syncs with the **Sync All** button.

### 10.2 System Logs & Diagnostics
- Go to **System Logs** to view timestamped audit logs.
- Filter by level (`INFO`, `WARN`, `ERROR`).
- Useful for diagnosing OAuth timeouts, database locks, or API rate limits.
