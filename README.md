# Unified AI Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-18.3.1-61dafb.svg)](https://react.dev/)
[![MySQL Database](https://img.shields.io/badge/MySQL-8.0%20%2F%208.4%20LTS-orange.svg)](https://www.mysql.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.1-38bdf8.svg)](https://tailwindcss.com/)
[![Local-First](https://img.shields.io/badge/Privacy-100%25%20Local--First-success.svg)](#security-privacy--local-data-sovereignty)
[![AI Providers](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI%20%7C%20Claude-purple.svg)](#supported-ai-providers)

> **Complete Local-First Intelligence Assistant for WhatsApp, Gmail & Google Drive.**  
> Unify personal and business communications, index unstructured documents locally, and query your entire digital footprint using multi-provider Large Language Models with autonomous tool execution.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Core Objectives](#core-objectives)
4. [Key Features](#key-features)
5. [Supported AI Providers](#supported-ai-providers)
6. [Supported Platform Integrations](#supported-platform-integrations)
7. [System Architecture Overview](#system-architecture-overview)
8. [Technology Stack](#technology-stack)
9. [Application Visual Tour](#application-visual-tour)
10. [Directory Structure](#directory-structure)
11. [System Requirements & Prerequisites](#system-requirements--prerequisites)
12. [Quickstart Guide](#quickstart-guide)
13. [Detailed Installation Guide](#detailed-installation-guide)
14. [Database Setup & Migration Commands](#database-setup--migration-commands)
15. [Environment Variable Reference](#environment-variable-reference)
16. [Application Modules Deep-Dive](#application-modules-deep-dive)
17. [AI Assistant & Hybrid Tool Retrieval Lifecycle](#ai-assistant--hybrid-tool-retrieval-lifecycle)
18. [Multi-Provider AI Configuration Guide](#multi-provider-ai-configuration-guide)
19. [Document Management & Extraction Pipeline](#document-management--extraction-pipeline)
20. [Automated Report Generation Engine](#automated-report-generation-engine)
21. [Intelligent Dashboards & Visual Analytics](#intelligent-dashboards--visual-analytics)
22. [Google OAuth 2.0 Walkthrough](#google-oauth-20-walkthrough)
23. [WhatsApp Integration Walkthrough](#whatsapp-integration-walkthrough)
24. [Entity Resolution & Cross-Platform Contact Linking](#entity-resolution--cross-platform-contact-linking)
25. [Background Synchronization & Polling Strategy](#background-synchronization--polling-strategy)
26. [Security, Privacy & Local Data Sovereignty](#security-privacy--local-data-sovereignty)
27. [Production Build & Deployment Guide](#production-build--deployment-guide)
28. [Troubleshooting & Common Issues](#troubleshooting--common-issues)
29. [Known Limitations & Technical Constraints](#known-limitations--technical-constraints)
30. [Testing Suite & Verification](#testing-suite--verification)
31. [Contributing Guidelines](#contributing-guidelines)
32. [License](#license)
33. [Acknowledgments & Community Contact](#acknowledgments--community-contact)

---

## Executive Summary

**Unified AI Workspace** is an enterprise-grade, local-first personal intelligence platform. It bridges the gap between fragmented personal communications (WhatsApp chats, Gmail threads) and unstructured documents (Google Drive files, PDFs, Word documents, spreadsheets) by aggregating them into an indexed, local relational database. 

Equipped with an advanced AI execution engine, Unified AI Workspace provides natural language search, cross-platform dossier synthesis, automated document parsing, multi-format business report generation (PDF, DOCX, XLSX, CSV), and real-time interactive business intelligence dashboards—all while keeping raw data securely on the user's host machine.

---

## Problem Statement

Modern professionals operate across siloed digital communication tools:
- Critical agreements, quotes, and delivery updates live in **WhatsApp** chats.
- Formal invoices, contracts, and legal notices live in **Gmail** threads.
- Reference specs, design files, and financial sheets live across nested **Google Drive** folders.

When answering critical business questions like *"What was the final negotiated rate for the equipment rental with Rahul, and where is the signed agreement?"*, users are forced to manually cross-reference three separate apps, manually search dates, open dozens of attachments, and manually piece together the timeline. Existing SaaS aggregation tools require sending all sensitive data to third-party cloud servers, posing severe privacy and compliance risks.

---

## Core Objectives

1. **Local Data Sovereignty:** Guarantee that all personal chats, emails, file attachments, and database indexes remain strictly on local disk.
2. **Unified Semantic & Relational Search:** Enable complex multi-source querying across WhatsApp, Gmail, and Drive in a single natural language prompt.
3. **Cross-Platform Identity Linking:** Automatically map phone numbers, email addresses, and company names into unified client entities.
4. **Autonomous AI Tool Calling:** Give modern LLMs (Google Gemini, OpenAI, Anthropic Claude) safe, read-only tools to retrieve exact local records before answering.
5. **Actionable Business Intelligence:** Automatically convert unstructured correspondence into structured dossiers, financial audit reports, and interactive charts.

---

## Key Features

- **100% Local-First Architecture:** Messages, emails, files, and derived embeddings/chunks are stored in your local MySQL 8.4 database and local filesystem.
- **Multi-Provider AI Core:** Seamlessly switch between **Google Gemini**, **OpenAI ChatGPT**, and **Anthropic Claude** with live API testing, model pickers, and encrypted key storage.
- **Natural Language Assistant with 18+ Tools:** Performs selective, parameterized tool calls (e.g., `search_whatsapp_messages`, `search_gmail_emails`, `search_drive_files`, `get_client_dossier`, `compare_documents`).
- **Direct WhatsApp Synchronization:** Connect via WhatsApp Web QR code using Baileys multi-device socket OR connect to an external WhatsApp REST Archive microservice.
- **Gmail Incremental Ingestion:** Secure OAuth 2.0 integration with automatic HTML email parsing, thread tracking, attachment downloads, and timestamp bookmarking.
- **Google Drive Parser & Chunking Pipeline:** Automatically pulls files, exports native Google Docs/Sheets into readable text, parses PDFs with `pdf-parse`, parses Word files with `mammoth`, and generates searchable text chunks.
- **Cross-Platform Entity Resolution:** Automatically merges disparate identifiers (`+919822...`, `rahul@company.com`, `Rahul Sharma`) into a single consolidated client profile with automated alias detection.
- **Documents Explorer & In-Browser Preview:** Interactive file browser with full-text search, metadata inspection, keyword highlighting, and direct download capabilities.
- **Enterprise Report Generation Engine:** Generate comprehensive 5-page reports (Executive Summaries, Financial Audits, Risk Assessments, Communication Timelines) exported as styled PDF, DOCX, XLSX, or CSV.
- **Dynamic BI Dashboards:** Visual sentiment breakdowns, message volume graphs, top active contacts, and connector health metrics rendered with Chart.js.
- **Live Synchronization Manager:** Dedicated UI displaying real-time connector state, record counts, active sync jobs, manual sync triggers, and error logs.
- **AES-256-GCM Credential Security:** All API keys and OAuth refresh tokens are encrypted at rest using authenticated AES-256-GCM before database insertion.

---

## Supported AI Providers

Unified AI Workspace features a provider-agnostic AI layer. You can configure multiple providers simultaneously and switch the active model on the fly:

| AI Provider | Default & Supported Models | Tool Calling Support | Configuration Mechanism |
|---|---|---|---|
| **Google Gemini** *(Primary)* | `gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro` | Native Tool Calling (`@google/genai`) | `GEMINI_API_KEY` in `.env` or Settings UI |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-mini` | JSON Schema Tools (`openai` SDK) | `OPENAI_API_KEY` in `.env` or Settings UI |
| **Anthropic Claude** | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-5-haiku-20241022` | XML / Tool Use Spec (`@anthropic-ai/sdk`) | `ANTHROPIC_API_KEY` in `.env` or Settings UI |

---

## Supported Platform Integrations

```
+-------------------------------------------------------------------------+
|                         UNIFIED AI WORKSPACE                            |
+--------------------+---------------------+------------------------------+
         |                     |                          |
         v                     v                          v
+-----------------+   +-----------------+        +------------------------+
|    WhatsApp     |   |      Gmail      |        |      Google Drive      |
+-----------------+   +-----------------+        +------------------------+
| * Baileys QR    |   | * Google OAuth  |        | * Google OAuth 2.0     |
| * Multi-Device  |   | * Readonly RFC  |        | * Drive v3 REST API    |
| * Archive API   |   | * HTML Stripper |        | * Docs/Sheets Export   |
| * Media Caching |   | * Attachments   |        | * PDF / DOCX Extractor |
+-----------------+   +-----------------+        +------------------------+
```

1. **WhatsApp Connector:**
   - **Mode A (Direct Baileys):** Generates terminal / UI QR codes. Connects directly to WhatsApp WebSocket servers. Stores session keys locally in encrypted auth folders.
   - **Mode B (Archive REST API):** Connects to external WhatsApp archiving services, local bridge daemons, or WhatsApp MCP servers via `WHATSAPP_API_BASE_URL`.
2. **Gmail Connector:**
   - Authenticates via Google OAuth 2.0 using the `https://www.googleapis.com/auth/gmail.readonly` scope.
   - Synchronizes message headers, bodies, thread relationships, and stores file attachments locally.
3. **Google Drive Connector:**
   - Authenticates via Google OAuth 2.0 using the `https://www.googleapis.com/auth/drive.readonly` scope.
   - Downloads binary files (PDFs, Images, Office files) and converts Google Docs and Sheets into raw text for chunked full-text search.

---

## System Architecture Overview

```
+-------------------------------------------------------------------------+
|                  Vite + React 18 Frontend (:5173)                       |
|   Tailwind CSS  |  Lucide Icons  |  Chart.js  |  Socket.IO Client       |
+------------------------------------+------------------------------------+
                                     | REST / Socket.IO
+------------------------------------v------------------------------------+
|                  Node.js + Express Backend (:5000)                      |
|                                                                         |
|   [ Controllers & Routes ]                                              |
|     /api/ai  |  /api/connections  |  /api/documents  |  /api/reports    |
|                                                                         |
|   [ Core AI Provider Manager ]                                          |
|     * Gemini Provider  * OpenAI Provider  * Claude Provider             |
|     * Local Tool Execution Engine (18 Relational & Search Tools)        |
|                                                                         |
|   [ Ingestion & Sync Pipeline ]                                         |
|     * Baileys WhatsApp Engine  * Google OAuth2 Client (Gmail/Drive)     |
|     * Document Text Extractor (pdf-parse, mammoth, xlsx)                |
|     * Entity Resolution & Auto-Aliasing Service                         |
+------------------+----------------------------------+-------------------+
                   |                                  |
                   v                                  v
      +-------------------------+        +--------------------------+
      |  MySQL 8.4 LTS Database |        |   Local File Storage     |
      |  (28 Normalized Tables) |        |   storage/drive/         |
      |  FULLTEXT Search Index  |        |   storage/gmail/         |
      |  Encrypted Credentials  |        |   storage/reports/       |
      +-------------------------+        +--------------------------+
```

---

## Technology Stack

### Frontend Architecture
- **Framework:** React 18.3.1 with React DOM
- **Build Tool:** Vite 5.2.0 (Fast HMR, optimized production rollup)
- **Styling:** Tailwind CSS 3.4.1 with PostCSS & Autoprefixer
- **Icons:** Lucide React
- **Data Visualization:** Chart.js 4.4.2 & React-Chartjs-2 5.2.0
- **Real-Time Client:** Socket.IO Client 4.7.5

### Backend Architecture
- **Runtime:** Node.js >= 20.0.0 (ECMAScript Modules)
- **Web Framework:** Express 4.19.2
- **Real-Time Engine:** Socket.IO 4.7.5
- **Database Driver:** MySQL2 3.9.7 with Promise-based pooling
- **Security & Crypto:** Built-in Node.js `crypto` (AES-256-GCM), `jsonwebtoken` 9.0.2
- **Document Extractors:** `pdf-parse` 1.1.1, `mammoth` 1.7.1, `xlsx` 0.18.5
- **Report Writers:** `pdfkit` 0.15.0, `docx` 8.5.0, `exceljs` 4.4.0
- **AI SDKs:** `@google/genai` 0.1.1, `openai` 4.38.0, `@anthropic-ai/sdk` 0.20.0
- **Connectors:** `@whiskeysockets/baileys` 6.6.0, `googleapis` 137.0.0, `axios` 1.6.8

---

## Application Visual Tour

```markdown
+-------------------------------------------------------------------------+
| [Screenshot Placeholder: Main Executive Dashboard]                     |
| Displays aggregate counts (Total WhatsApp Messages, Emails Ingested,   |
| Indexed Drive Files, Active Entities), communication volume graphs,    |
| sentiment breakdown, and real-time connector status indicators.         |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
| [Screenshot Placeholder: AI Assistant Chat Interface]                   |
| Shows multi-turn conversation with dynamic model selector pill,         |
| live search scope filters (WA, Gmail, Drive), tool-execution traces,    |
| cited original records, and copy-to-clipboard functionality.            |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
| [Screenshot Placeholder: Multi-Provider AI Settings]                   |
| Card-based configuration for Google Gemini, OpenAI, and Anthropic Claude|
| with real-time "Test Connection" status badges and model pickers.       |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
| [Screenshot Placeholder: Automated Report Generator]                    |
| Selection interface for Executive Summaries and Financial Audits,       |
| scope selector, date ranges, and one-click PDF/DOCX/XLSX export.        |
+-------------------------------------------------------------------------+
```

---

## Directory Structure

```
unified-ai-workspace/
├── .env.example                     # Root environment configuration template
├── .gitignore                       # Strict git exclusion rules for secrets/storage
├── LICENSE                          # MIT Open Source License
├── package.json                     # Monorepo root scripts (dev, test, seed:demo)
├── README.md                        # Master project documentation
├── runner.js                        # Unified process orchestrator & health checker
├── testSuite.js                     # Complete end-to-end integration test suite
│
├── backend/                         # Express.js REST API & AI Server
│   ├── .env.example                 # Backend environment variable template
│   ├── package.json                 # Backend dependencies & script definitions
│   ├── scripts/                     # Operational & verification scripts
│   │   ├── mock-whatsapp-service.js # Standalone mock WhatsApp microservice (:3001)
│   │   └── verify-whatsapp-api.js   # Automated connector testing script
│   ├── src/
│   │   ├── index.js                 # HTTP server bootstrap & Socket.IO initialization
│   │   ├── config/
│   │   │   ├── env.js               # Typed configuration loader & validator
│   │   │   └── google.js            # Google OAuth2 client initialization
│   │   ├── controllers/             # REST route handler logic
│   │   │   ├── aiController.js      # Chat, streaming, and tool execution
│   │   │   ├── connectionsController.js # WhatsApp, Gmail, Drive management
│   │   │   ├── documentsController.js   # File ingestion and search endpoints
│   │   │   ├── reportsController.js     # Multi-format report builder
│   │   │   └── settingsController.js    # AI provider key and model management
│   │   ├── database/
│   │   │   ├── connection.js        # MySQL2 connection pool setup
│   │   │   ├── migrate.js           # Automated SQL migration runner
│   │   │   ├── seed.js              # Default admin & settings seeder
│   │   │   ├── seedDemo.js          # Optional sample mock data seeder
│   │   │   └── migrations/          # Versioned SQL migration scripts
│   │   ├── middleware/              # Auth, validation, and error interceptors
│   │   ├── routes/                  # Express API route declarations
│   │   ├── services/
│   │   │   ├── ai/                  # AI providers (Gemini, OpenAI, Claude) & tools
│   │   │   ├── connectors/          # Baileys, Gmail, and Google Drive drivers
│   │   │   ├── documents/           # PDF, Word, Excel parsers & chunkers
│   │   │   ├── entities/            # Entity resolution & alias mapping
│   │   │   └── reports/             # PDFKit, Docx, and ExcelJS generators
│   │   └── utils/                   # AES-256 crypto, logging, formatters
│   └── storage/                     # Local data cache (EXCLUDED from git)
│       ├── drive/                   # Downloaded & cached Drive binaries
│       ├── gmail/                   # Downloaded email attachments
│       ├── reports/                 # Generated PDF/DOCX/XLSX artifacts
│       └── whatsapp/                # Baileys session keys and WhatsApp media
│
├── frontend/                        # React 18 + Vite Single Page Application
│   ├── index.html                   # HTML entry point
│   ├── package.json                 # Frontend UI dependencies
│   ├── tailwind.config.js           # Custom Tailwind design tokens & dark mode
│   ├── vite.config.js               # Vite build configuration & API proxy
│   └── src/
│       ├── App.jsx                  # Main application routing and shell
│       ├── main.jsx                 # React root renderer
│       ├── components/              # Shared UI components, layout, and nav
│       ├── pages/                   # High-level route views
│       │   ├── Dashboard.jsx        # Business intelligence overview
│       │   ├── AIAssistant.jsx      # Multi-turn chat & tool caller
│       │   ├── Connections.jsx      # WhatsApp, Gmail, Drive link manager
│       │   ├── Documents.jsx        # Document explorer & full-text preview
│       │   ├── Entities.jsx         # Clients, companies, and alias manager
│       │   ├── Synchronization.jsx  # Sync manager, job status, and logs
│       │   ├── Reports.jsx          # Custom report generator & exporter
│       │   └── Settings.jsx         # Multi-provider AI key manager
│       ├── services/                # Axios API clients & WebSocket listeners
│       └── utils/                   # Frontend formatters and date helpers
│
└── docs/                            # Deep-dive architecture & integration guides
    ├── ARCHITECTURE_AND_INTEGRATIONS.md # Sequence diagrams & low-level internals
    ├── USER_GUIDE.md                # End-user visual walkthrough & tutorials
    └── SECURITY.md                  # Cryptographic disclosure & threat model
```

---

## System Requirements & Prerequisites

### Minimum Hardware
- **Processor:** Dual-Core 2.0 GHz or higher (x86_64 or Apple Silicon ARM64)
- **RAM:** Minimum 4 GB (8 GB recommended for large document chunking and local indexing)
- **Disk Space:** Minimum 2 GB free disk space (more depending on Drive attachments)

### Operating System
- **Windows:** Windows 10 / 11 (PowerShell 5.1+ or PowerShell Core)
- **macOS:** macOS 12 (Monterey) or newer
- **Linux:** Ubuntu 20.04+, Debian 11+, Fedora 38+, or Arch Linux

### Software Prerequisites
1. **Node.js:** v20.0.0 LTS or newer (`node -v`)
2. **npm:** v10.0.0 or newer (`npm -v`)
3. **MySQL Server:** v8.0 or v8.4 LTS (`mysql --version`)
4. **Git:** v2.30.0 or newer (`git --version`)

---

## Quickstart Guide

Get Unified AI Workspace running in under 3 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/unified-ai-workspace.git
cd unified-ai-workspace

# 2. Run the one-step startup runner
npm run dev
```

*The runner script will check dependencies, apply database migrations, seed initial records, and launch both backend (`http://localhost:5000`) and frontend (`http://localhost:5173`) automatically!*

---

## Detailed Installation Guide

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/unified-ai-workspace.git
cd unified-ai-workspace
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

### Step 3: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### Step 4: Configure MySQL Database
Log into your local MySQL CLI as `root` or an administrator:
```sql
CREATE DATABASE IF NOT EXISTS unified_ai_workspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 5: Configure Environment Variables
Copy `.env.example` in `backend/`:
```bash
cp .env.example backend/.env
```

Open `backend/.env` in your text editor and set your MySQL credentials and Google Gemini API key:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=unified_ai_workspace

GEMINI_API_KEY=AIzaSy...your_gemini_api_key
```

### Step 6: Run Database Migrations and Seed
```bash
cd backend
npm run db:migrate
npm run db:seed
cd ..
```

*(Optional: Run `npm run seed:demo` if you wish to load sample clients, messages, and mock documents for offline evaluation).*

### Step 7: Launch the Application
You can start the backend and frontend concurrently from the root directory:
```bash
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## Database Setup & Migration Commands

All database operations are managed via reproducible scripts located in `backend/src/database/`:

| Command | Working Directory | Description |
|---|---|---|
| `npm run db:migrate` | `backend/` | Applies all pending `.sql` migration files in sequence. |
| `npm run db:seed` | `backend/` | Creates the default workspace user and default system settings. |
| `npm run seed:demo` | Root or `backend/` | Injects synthetic demonstration data (chats, emails, files). |
| `npm test` | Root | Runs the end-to-end integration and database validation suite. |

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `5000` | Port for the Express.js HTTP/WebSocket server. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development` or `production`). |
| `CLIENT_ORIGIN` | Optional | `http://localhost:5173` | Allowed CORS origin for frontend client requests. |
| `JWT_SECRET` | **Required** | *Random string* | Secret key for signing authentication JSON Web Tokens. |
| `CREDENTIAL_ENCRYPTION_KEY` | **Required** | *32-char string* | **Exact 32-character** key for AES-256-GCM token encryption. |
| `DB_HOST` | **Required** | `127.0.0.1` | Hostname or IP address of your MySQL database server. |
| `DB_PORT` | Optional | `3306` | Port of your MySQL server. |
| `DB_USER` | **Required** | `root` | MySQL username with CRUD and DDL permissions. |
| `DB_PASSWORD` | **Required** | `""` | Password for the MySQL user. |
| `DB_NAME` | **Required** | `unified_ai_workspace` | Target database schema name. |
| `GEMINI_API_KEY` | **Required\*** | `""` | Google AI Studio API key for Gemini LLM. |
| `GEMINI_MODEL` | Optional | `gemini-3.1-flash-lite` | Default Gemini model identifier. |
| `OPENAI_API_KEY` | Optional | `""` | OpenAI API key for ChatGPT models. |
| `ANTHROPIC_API_KEY` | Optional | `""` | Anthropic Claude API key. |
| `GOOGLE_CLIENT_ID` | Optional | `""` | Google Cloud Console OAuth 2.0 Client ID. |
| `GOOGLE_CLIENT_SECRET` | Optional | `""` | Google Cloud Console OAuth 2.0 Client Secret. |
| `GOOGLE_REDIRECT_URI` | Optional | `http://localhost:5000/api/connections/google/callback` | OAuth 2.0 authorized callback URI. |
| `STORAGE_PATH` | Optional | `../../storage` | Path for cached local files and generated reports. |
| `WHATSAPP_API_BASE_URL` | Optional | `http://localhost:3001` | Base URL for external WhatsApp archive microservice. |
| `WHATSAPP_API_KEY` | Optional | `""` | Optional authorization key for WhatsApp microservice. |

*\*Note: An API key for at least one AI provider (Gemini, OpenAI, or Claude) is required to use the AI Assistant.*

---

## Application Modules Deep-Dive

1. **Executive Dashboard (`/`):**
   Real-time telemetry on total synchronized messages, emails, indexed documents, and active entities. Displays communication velocity charts and platform health.
2. **AI Assistant (`/ai`):**
   Full-featured conversational interface. Supports search scope toggling (WhatsApp, Gmail, Drive), model switching, multi-turn context retention, tool invocation indicators, and original record citation cards.
3. **Connections Manager (`/connections`):**
   Unified hub for managing data connectors. Features live QR code display for WhatsApp Web pairing, one-click Google OAuth 2.0 sign-in, and synchronization triggers.
4. **Clients & Entities (`/entities`):**
   Entity management workspace displaying resolved contacts and organizations. View consolidated dossiers, communication timelines, and linked phone numbers and email addresses.
5. **Documents Explorer (`/documents`):**
   In-browser document management system. Filter by file type (PDF, Word, Spreadsheet, Plain Text), inspect chunk count, search document text, and preview contents directly in the browser.
6. **Synchronization Manager (`/synchronization`):**
   Mission-control center for data ingestion. Shows background sync jobs, message ingestion rates, error logs, and execution times.
7. **Automated Reports (`/reports`):**
   Generate business reports on demand. Select from Executive Summaries, Financial Audits, or Risk Analysis, customize parameters, and export to PDF, Word, Excel, or CSV.
8. **Settings & Providers (`/settings`):**
   Configure system preferences and manage AI providers (Gemini, OpenAI, Claude). Test connections with real API pings and change active models without restarting the server.

---

## AI Assistant & Hybrid Tool Retrieval Lifecycle

When a user submits a query to the AI Assistant:

```
[ User Prompt ]
       |
       v
[ AI Manager ] ---> [ Resolves Active Provider: Gemini / OpenAI / Claude ]
       |
       v
[ LLM Execution Loop with 18+ Tools ]
  ├─> Evaluates prompt intent
  ├─> Emits Tool Call: e.g. `search_whatsapp_messages({ query: 'rental' })`
  │         |
  │         v
  │   [ Backend Tool Handler ]
  │   Executes optimized local SQL query on MySQL 8.4
  │   Returns matching rows (raw text, sender, timestamp)
  │         |
  │         v
  ├─> Sends Tool Response back to LLM context
  └─> LLM analyzes retrieved evidence and generates comprehensive answer
       |
       v
[ Assistant Response Rendered in UI with Citation Badges ]
```

---

## Multi-Provider AI Configuration Guide

Unified AI Workspace provides complete flexibility to choose your AI engine:

1. **Google Gemini:**
   - Sign up at [Google AI Studio](https://aistudio.google.com/) and create an API key.
   - Enter your key under **Settings > AI Provider Configuration > Google Gemini**.
   - Select your preferred model (e.g., `gemini-3.1-flash-lite`, `gemini-2.5-flash`).
2. **OpenAI:**
   - Obtain an API key from [OpenAI Platform](https://platform.openai.com/).
   - Enter your key under **Settings > OpenAI / ChatGPT**.
   - Choose models such as `gpt-4o` or `gpt-4o-mini`.
3. **Anthropic Claude:**
   - Obtain an API key from [Anthropic Console](https://console.anthropic.com/).
   - Enter your key under **Settings > Anthropic Claude**.
   - Select models such as `claude-3-5-sonnet-20241022`.

*All keys entered via the UI are encrypted via AES-256-GCM before storage in the database.*

---

## Document Management & Extraction Pipeline

When files are downloaded from Google Drive or uploaded directly:
1. **MIME Detection:** Files are inspected to determine type (`application/pdf`, `text/plain`, `docx`, `xlsx`, `csv`).
2. **Text Extraction:**
   - **PDF:** Extracted via `pdf-parse`.
   - **DOCX:** Extracted via `mammoth` into clean plain text.
   - **XLSX / CSV:** Parsed into structured tabular rows.
   - **Google Docs / Sheets:** Exported directly from Drive as plain text / CSV.
3. **Text Chunking:** Clean text is split into contextual chunks (typically 1,000 characters with 150-character overlap) to enable granular retrieval.
4. **Relational Indexing:** Chunks are saved in `document_chunks` with `FULLTEXT` indexing on `chunk_text`.

---

## Automated Report Generation Engine

Generate polished corporate documents with one click:

| Report Type | Generated Sections | Supported Export Formats |
|---|---|---|
| **Client Executive Summary** | Client profile, communication volume, key agreements, sentiment, open action items | PDF, DOCX, XLSX, CSV |
| **Financial & Invoicing Audit** | Discussed payments, quotations, invoice references, payment confirmations, variance analysis | PDF, DOCX, XLSX, CSV |
| **Risk & Commitment Review** | Pending deliverables, overdue commitments, escalations, risk scoring | PDF, DOCX, XLSX, CSV |
| **Communication Timeline** | Chronological record of all WhatsApp and Gmail exchanges across dates | PDF, DOCX, XLSX, CSV |

---

## Intelligent Dashboards & Visual Analytics

The interactive Dashboard features:
- **Metrics Bar:** Total synced records, active clients, unread notifications, and storage utilization.
- **Activity Graph:** 30-day timeline of incoming and outgoing communications across WhatsApp and Gmail.
- **Sentiment Breakdown:** Donut chart categorizing client sentiment into Positive, Neutral, and Urgent/Concern.
- **Top Entities:** Leaderboard of contacts with the highest interaction frequency.

---

## Google OAuth 2.0 Walkthrough

To enable Gmail and Google Drive integration:

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Unified AI Workspace`.
3. Go to **APIs & Services > Library** and enable:
   - **Gmail API**
   - **Google Drive API**
4. Configure the **OAuth Consent Screen**:
   - User Type: **External**
   - App Name: `Unified AI Workspace`
   - Scopes: Add `.../auth/gmail.readonly` and `.../auth/drive.readonly`
   - Test Users: Add your Google email address.
5. Create **OAuth 2.0 Client Credentials**:
   - Application Type: **Web application**
   - Authorized Redirect URI: `http://localhost:5000/api/connections/google/callback`
6. Copy the generated **Client ID** and **Client Secret** into your `backend/.env` file.
7. Open the application, go to **Connections**, and click **Connect Gmail** or **Connect Drive**.

---

## WhatsApp Integration Walkthrough

Unified AI Workspace supports two flexible WhatsApp synchronization workflows:

### Method A: Direct Baileys QR Code (Recommended)
1. Navigate to **Connections** in the sidebar.
2. Under the WhatsApp card, click **Connect / Show QR Code**.
3. Open WhatsApp on your mobile device:
   - **iOS:** Settings > Linked Devices > Link a Device.
   - **Android:** Three dots > Linked Devices > Link a Device.
4. Scan the QR code. The connection will verify and save the session locally.
5. Click **Sync Now** to pull chats, messages, and contacts.

### Method B: WhatsApp Archive REST Microservice
If you maintain an external WhatsApp bridge or archive service:
1. Ensure the service is running (e.g. `http://localhost:3001`).
2. Set `WHATSAPP_API_BASE_URL=http://localhost:3001` in `backend/.env`.
3. The system will automatically use the REST archive endpoints for live synchronization.

---

## Entity Resolution & Cross-Platform Contact Linking

Unified AI Workspace solves contact fragmentation using an automated identity resolution service:
- Normalizes phone numbers into international E.164 format (e.g. `+91 98220 00001` -> `919822000001`).
- Normalizes email addresses to lowercase trimmed strings.
- Automatically associates incoming messages with existing `entities` or creates new records.
- Allows users to merge contacts, define company affiliations, and add manual aliases in the **Clients & Entities** view.

---

## Background Synchronization & Polling Strategy

- **Incremental Syncing:** Connectors track the latest ingested message timestamp or message ID (`history_sync_timestamp`). Subsequent syncs only fetch delta records.
- **Scheduled Background Polling:** Built-in timers periodically poll active connectors at configurable intervals without blocking user interaction.
- **Graceful Rate Limiting:** Google API requests utilize exponential backoff to comply with Google Cloud quotas.

---

## Security, Privacy & Local Data Sovereignty

- **Zero Cloud Leakage:** Raw communications, attachments, and database tables remain on your local machine.
- **AES-256-GCM Encryption:** Credentials, OAuth refresh tokens, and third-party API keys are encrypted before storage.
- **Sanitized AI Retrieval:** Only specific, relevant search snippets retrieved by tool calls are sent to external LLMs to answer questions; entire mailboxes and chat databases are never uploaded.
- **No Third-Party Analytics:** The application contains zero tracking pixels, telemetry probes, or external analytics scripts.

---

## Production Build & Deployment Guide

To deploy Unified AI Workspace as a permanent local or home-server service:

### 1. Build the Frontend
```bash
cd frontend
npm run build
cd ..
```

### 2. Configure Production Mode
In `backend/.env`, set:
```env
NODE_ENV=production
PORT=5000
```

### 3. Run with Process Manager (PM2)
```bash
npm install -g pm2
pm2 start backend/src/index.js --name "unified-ai-workspace"
pm2 save
pm2 startup
```

---

## Troubleshooting & Common Issues

### 1. Database Access Denied (`ER_ACCESS_DENIED_ERROR`)
- **Cause:** Incorrect `DB_USER` or `DB_PASSWORD` in `backend/.env`.
- **Solution:** Verify your credentials by logging in directly via command line:
  ```bash
  mysql -u root -p
  ```
  Ensure your user has access to `unified_ai_workspace`.

### 2. Google OAuth `redirect_uri_mismatch`
- **Cause:** The redirect URI in Google Cloud Console does not match `GOOGLE_REDIRECT_URI`.
- **Solution:** In Google Cloud Console, add `http://localhost:5000/api/connections/google/callback` to **Authorized Redirect URIs**.

### 3. Google OAuth "Access Blocked: App Has Not Completed Verification"
- **Cause:** App is in Testing mode in Google Cloud Console.
- **Solution:** Add your personal Gmail address to the **Test Users** list in the OAuth Consent Screen configuration.

### 4. WhatsApp QR Code Disappears or Fails to Pair
- **Cause:** WhatsApp Web socket timed out before scanning.
- **Solution:** Click **Refresh QR Code** in the Connections UI. Ensure your mobile phone has an active internet connection.

### 5. Gemini API `429 Quota Exceeded`
- **Cause:** Free tier Gemini API request rate limit reached.
- **Solution:** Switch to `gemini-3.1-flash-lite` in Settings, or add an OpenAI / Anthropic API key as a fallback provider.

---

## Known Limitations & Technical Constraints

- **Google OAuth Testing Mode:** Google OAuth tokens in "Testing" mode expire after 7 days, requiring re-authentication.
- **WhatsApp Multi-Device Restarts:** If your phone remains offline for more than 14 days, WhatsApp automatically revokes the linked session.
- **Scanned Image PDFs:** The built-in PDF extractor parses digital text. Scanned document images without an embedded text layer require an external OCR engine.
- **LLM Rate Limits:** Free-tier AI provider keys may experience rate limiting during intensive document summarization tasks.

---

## Testing Suite & Verification

Unified AI Workspace includes a comprehensive integration test suite:

```bash
# Run the complete test suite
npm test
```

The test runner verifies:
- MySQL 8.4 database connectivity and pool health
- Integrity of all 28 database tables
- Text extraction and chunking algorithms
- FULLTEXT search queries across messages and files
- Encryption and decryption of secrets via AES-256-GCM
- AI tool definitions and schema validity

---

## Contributing Guidelines

Contributions are welcome! Please follow these steps:
1. **Fork** the repository on GitHub.
2. **Create a branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Commit** your changes following conventional commit syntax:
   ```bash
   git commit -m "feat: add support for local Ollama models"
   ```
4. **Push** to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
5. Open a **Pull Request** explaining your changes.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments & Community Contact

- Built with modern open-source technologies: [Node.js](https://nodejs.org/), [React](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Baileys](https://github.com/WhiskeySockets/Baileys), and [MySQL](https://www.mysql.com/).
- Designed for individuals and teams who value **privacy, data ownership, and local-first AI**.
- For bug reports, questions, and feature requests, please open an issue in the [GitHub Issue Tracker](https://github.com/your-username/unified-ai-workspace/issues).
