# Database Schema Documentation

**Database:** `unified_ai_workspace`  
**RDBMS:** MySQL 8.4 LTS  
**Character Set:** `utf8mb4` (Collation: `utf8mb4_unicode_ci`)  
**Engine:** InnoDB  

---

## 1. Schema Architecture Overview

The database is structured into 6 logical domains:
1. **Core & Auth:** Users, settings, connected accounts, credentials, and sync jobs.
2. **Entities & Identity Resolution:** Cross-platform contacts, company entities, aliases, and relationships.
3. **WhatsApp:** Chats, messages, contacts, groups, and local attachment references.
4. **Gmail:** Email threads, individual messages, recipients, and attachments.
5. **Google Drive:** Folders, files, extracted contents, and metadata.
6. **AI Assistant & Document Chunks:** Conversations, messages, citations, search logs, and chunked vector/full-text embeddings.

---

## 2. Table Catalog

### Core & System Tables

- **`users`**
  - `id` (INT PK AI): Unique user identifier.
  - `username` (VARCHAR(100) UNIQUE): Login username.
  - `email` (VARCHAR(255) UNIQUE): User email.
  - `password_hash` (VARCHAR(255)): Bcrypt salted hash.
  - `full_name` (VARCHAR(150)): Display name.
  - `role` (VARCHAR(50)): Security role (`admin`).
  - `created_at`, `updated_at`: UTC timestamps.

- **`app_settings`**
  - `setting_key` (VARCHAR(100) PK): Configuration key (e.g. `gemini_model`, `sync_interval_mins`, `ai_allowed_sources`).
  - `setting_value` (LONGTEXT): JSON or string setting value.
  - `description` (VARCHAR(255)): Setting description.
  - `is_encrypted` (BOOLEAN): Flag for encrypted at-rest values.
  - `updated_at`: UTC timestamp.

- **`connected_accounts`**
  - `id` (INT PK AI): Connector account ID.
  - `user_id` (INT FK -> users.id): Account owner.
  - `platform` (ENUM: `whatsapp`, `gmail`, `drive`).
  - `account_identifier` (VARCHAR(255)): Phone number, email, or Google account ID.
  - `account_name` (VARCHAR(255)): Friendly display name.
  - `status` (ENUM: `connected`, `disconnected`, `syncing`, `error`).
  - `scopes` (TEXT): OAuth scopes granted.
  - `credentials_encrypted` (LONGTEXT): AES-256-GCM encrypted tokens.
  - `metadata_json` (JSON): Platform specific metadata.
  - `last_sync_at`: Timestamp of most recent sync job.
  - Unique Constraint: `(user_id, platform, account_identifier)`.

- **`connector_sessions`**
  - `id` (INT PK AI): Session record.
  - `connected_account_id` (INT FK -> connected_accounts.id).
  - `session_key` (VARCHAR(150)): Baileys key or OAuth refresh handle.
  - `session_data_encrypted` (LONGTEXT): AES-256-GCM encrypted session state.
  - `expires_at`: Token expiry timestamp.

- **`sync_jobs`**
  - `id` (INT PK AI): Synchronization task.
  - `connected_account_id` (INT FK -> connected_accounts.id).
  - `platform` (ENUM: `whatsapp`, `gmail`, `drive`).
  - `job_type` (ENUM: `initial`, `incremental`, `manual`).
  - `status` (ENUM: `pending`, `running`, `completed`, `failed`, `cancelled`).
  - `progress_pct` (INT): Percentage completed 0-100.
  - `records_processed` (INT): Count of records stored.
  - `records_failed` (INT): Count of failed items.
  - `checkpoint_cursor` (VARCHAR(255)): Gmail `historyId` or Drive `startPageToken`.
  - `error_message` (TEXT): Failure diagnostics.
  - `started_at`, `completed_at`, `created_at`: Timestamps.

- **`sync_logs`**
  - `id` (BIGINT PK AI): Live sync audit log.
  - `sync_job_id` (INT FK -> sync_jobs.id).
  - `platform` (ENUM: `whatsapp`, `gmail`, `drive`).
  - `log_level` (ENUM: `info`, `warn`, `error`, `debug`).
  - `message` (TEXT): Log line.
  - `details_json` (JSON): Structured payload.

---

### Entity Resolution & Contacts

- **`contacts`**
  - `id` (INT PK AI).
  - `user_id` (INT FK -> users.id).
  - `source_platform` (ENUM: `whatsapp`, `gmail`, `drive`, `manual`).
  - `external_id` (VARCHAR(255)): Platform JID, email, or owner ID.
  - `name`, `display_name`, `phone_number`, `email`, `avatar_url`, `metadata_json`.
  - Indexes: `phone_number`, `email`.

- **`entities`**
  - `id` (INT PK AI).
  - `user_id` (INT FK -> users.id).
  - `entity_type` (ENUM: `individual`, `company`, `client`, `supplier`, `project`).
  - `primary_name` (VARCHAR(255)): Canonical entity name (e.g., "XYZ Enterprises", "Rahul Sharma").
  - `company_name`, `email`, `phone`, `status`, `notes`.
  - `confidence_score` (DECIMAL(5,2)): Automated resolution confidence.

- **`entity_aliases`**
  - `id` (INT PK AI).
  - `entity_id` (INT FK -> entities.id).
  - `alias_name` (VARCHAR(255)): Nicknames, phone variants, alternate emails.
  - `alias_type` (ENUM: `name`, `email`, `phone`, `company`).
  - `source_platform`, `external_id`, `confidence`.

- **`entity_relationships`**
  - Cross-entity relationships (`works_for`, `partner_of`, etc.).

---

### WhatsApp Domain

- **`wa_chats`**: Chat dialogues and metadata.
- **`wa_messages`**: Chat messages with `FULLTEXT (text_content, caption)`.
- **`wa_contacts`**: WhatsApp address book with phone indexes.
- **`wa_groups` & `wa_group_members`**: Groups and participant memberships.
- **`wa_attachments`**: Attachment metadata, local paths, and SHA-256 hashes.

---

### Gmail Domain

- **`email_threads`**: Gmail threads with message counts and history IDs.
- **`emails`**: Ingested emails with `FULLTEXT (subject, body_plain)`.
- **`email_attachments`**: Downloaded attachments with SHA-256 deduplication.

---

### Google Drive Domain

- **`drive_folders`**: Folder hierarchy.
- **`drive_files`**: File metadata with `FULLTEXT (name)`.
- **`drive_file_contents`**: Extracted text content with `FULLTEXT (raw_text)`.

---

### Document Processing & AI Domain

- **`document_chunks`**: Universal text chunks (1000 chars, 200 overlap) with `FULLTEXT (chunk_text, filename)`. Retains `source_platform`, `original_record_id`, `file_id`, `page_number`, `chunk_index`.
- **`ai_conversations`**: Chat sessions.
- **`ai_messages`**: Chat messages with function call traces and token usage.
- **`ai_query_sources`**: Granular source citations linked to messages.
- **`ai_search_history`**: Audit trail of search queries and performance.
