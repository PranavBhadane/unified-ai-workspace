-- UNIFIED AI WORKSPACE: Database Migration 001
-- Initial Schema for MySQL 8.4 LTS

-- --------------------------------------------------------
-- CORE: Users & Application Settings
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value LONGTEXT,
    description VARCHAR(255),
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS connected_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    platform ENUM('whatsapp', 'gmail', 'drive') NOT NULL,
    account_identifier VARCHAR(255) NOT NULL, -- phone number, email address, or drive root account
    account_name VARCHAR(255),
    status ENUM('connected', 'disconnected', 'syncing', 'error') DEFAULT 'disconnected',
    scopes TEXT,
    credentials_encrypted LONGTEXT,
    metadata_json JSON,
    last_sync_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_platform_identifier (user_id, platform, account_identifier),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS connector_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    session_key VARCHAR(150) NOT NULL,
    session_data_encrypted LONGTEXT NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_session (connected_account_id, session_key),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    platform ENUM('whatsapp', 'gmail', 'drive') NOT NULL,
    job_type ENUM('initial', 'incremental', 'manual') DEFAULT 'manual',
    status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    progress_pct INT DEFAULT 0,
    records_processed INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    checkpoint_cursor VARCHAR(255),
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sync_job_id INT,
    platform ENUM('whatsapp', 'gmail', 'drive') NOT NULL,
    log_level ENUM('info', 'warn', 'error', 'debug') DEFAULT 'info',
    message TEXT NOT NULL,
    details_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- ENTITIES & CONTACT RESOLUTION
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source_platform ENUM('whatsapp', 'gmail', 'drive', 'manual') NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    display_name VARCHAR(255),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    metadata_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_source_external (user_id, source_platform, external_id),
    INDEX idx_phone (phone_number),
    INDEX idx_email (email),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entity_type ENUM('individual', 'company', 'client', 'supplier', 'project') DEFAULT 'client',
    primary_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
    notes TEXT,
    confidence_score DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_primary_name (primary_name),
    INDEX idx_company (company_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entity_aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_id INT NOT NULL,
    alias_name VARCHAR(255) NOT NULL,
    alias_type ENUM('name', 'email', 'phone', 'company') NOT NULL,
    source_platform ENUM('whatsapp', 'gmail', 'drive', 'manual') DEFAULT 'manual',
    external_id VARCHAR(255),
    confidence DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alias_search (alias_name, alias_type),
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entity_relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_id_1 INT NOT NULL,
    entity_id_2 INT NOT NULL,
    relationship_type VARCHAR(100) NOT NULL, -- e.g., 'works_for', 'partner_of', 'subsidiary_of'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id_1) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id_2) REFERENCES entities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- WHATSAPP SCHEMA
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    jid VARCHAR(150) NOT NULL,
    name VARCHAR(255),
    is_group BOOLEAN DEFAULT FALSE,
    unread_count INT DEFAULT 0,
    last_message_timestamp BIGINT,
    metadata_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_chat_jid (connected_account_id, jid),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    chat_jid VARCHAR(150) NOT NULL,
    message_id VARCHAR(150) NOT NULL,
    sender_jid VARCHAR(150),
    sender_name VARCHAR(255),
    timestamp BIGINT NOT NULL,
    message_type ENUM('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'other') DEFAULT 'text',
    text_content TEXT,
    caption TEXT,
    has_media BOOLEAN DEFAULT FALSE,
    media_url TEXT,
    media_path VARCHAR(500),
    media_mimetype VARCHAR(100),
    media_size BIGINT,
    is_from_me BOOLEAN DEFAULT FALSE,
    raw_data_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_message (connected_account_id, message_id),
    INDEX idx_chat_timestamp (chat_jid, timestamp),
    INDEX idx_sender (sender_jid),
    FULLTEXT INDEX ft_wa_text (text_content, caption),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    jid VARCHAR(150) NOT NULL,
    name VARCHAR(255),
    notify_name VARCHAR(255),
    verified_name VARCHAR(255),
    phone_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_wa_contact (connected_account_id, jid),
    INDEX idx_wa_phone (phone_number),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    group_jid VARCHAR(150) NOT NULL,
    subject VARCHAR(255),
    owner_jid VARCHAR(150),
    creation_timestamp BIGINT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_wa_group (connected_account_id, group_jid),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_jid VARCHAR(150) NOT NULL,
    user_jid VARCHAR(150) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_superadmin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_group_member (group_jid, user_jid),
    INDEX idx_member_user (user_jid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_attachments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    sha256_hash VARCHAR(64),
    download_status ENUM('pending', 'downloaded', 'failed', 'expired') DEFAULT 'downloaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sha256 (sha256_hash),
    FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- GMAIL SCHEMA
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_threads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    thread_id VARCHAR(100) NOT NULL,
    snippet TEXT,
    history_id VARCHAR(100),
    message_count INT DEFAULT 1,
    last_message_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_thread (connected_account_id, thread_id),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emails (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    thread_id VARCHAR(100) NOT NULL,
    message_id VARCHAR(100) NOT NULL,
    history_id VARCHAR(100),
    sender_name VARCHAR(255),
    sender_email VARCHAR(255) NOT NULL,
    recipient_to TEXT,
    recipient_cc TEXT,
    recipient_bcc TEXT,
    subject VARCHAR(500),
    snippet TEXT,
    body_plain LONGTEXT,
    body_html LONGTEXT,
    internal_date BIGINT,
    labels_json JSON,
    has_attachments BOOLEAN DEFAULT FALSE,
    headers_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_email_msg (connected_account_id, message_id),
    INDEX idx_sender_email (sender_email),
    INDEX idx_email_thread (thread_id),
    INDEX idx_internal_date (internal_date),
    FULLTEXT INDEX ft_email_content (subject, body_plain),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_attachments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email_id BIGINT NOT NULL,
    attachment_id VARCHAR(255),
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    file_path VARCHAR(500),
    sha256_hash VARCHAR(64),
    download_status ENUM('pending', 'downloaded', 'failed') DEFAULT 'downloaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_att_hash (sha256_hash),
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- GOOGLE DRIVE SCHEMA
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS drive_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    folder_id VARCHAR(150) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(150),
    web_view_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_folder (connected_account_id, folder_id),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drive_files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connected_account_id INT NOT NULL,
    file_id VARCHAR(150) NOT NULL,
    name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150),
    size_bytes BIGINT DEFAULT 0,
    parent_id VARCHAR(150),
    web_view_link TEXT,
    web_content_link TEXT,
    icon_link TEXT,
    md5_checksum VARCHAR(64),
    sha256_hash VARCHAR(64),
    drive_created_time TIMESTAMP NULL,
    drive_modified_time TIMESTAMP NULL,
    owners_json JSON,
    is_trashed BOOLEAN DEFAULT FALSE,
    local_file_path VARCHAR(500),
    download_status ENUM('pending', 'downloaded', 'unsupported', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_account_file (connected_account_id, file_id),
    INDEX idx_parent (parent_id),
    INDEX idx_drive_mod (drive_modified_time),
    FULLTEXT INDEX ft_drive_file_name (name),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drive_file_contents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT NOT NULL,
    raw_text LONGTEXT,
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_file_id (file_id),
    FULLTEXT INDEX ft_drive_raw_text (raw_text),
    FOREIGN KEY (file_id) REFERENCES drive_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- DOCUMENT CHUNKS & INDEXED TEXT CHUNKS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_platform ENUM('whatsapp', 'gmail', 'drive', 'upload') NOT NULL,
    original_record_id BIGINT,
    file_id VARCHAR(150),
    filename VARCHAR(500),
    sender_or_owner VARCHAR(255),
    timestamp TIMESTAMP NULL,
    page_number INT DEFAULT 1,
    chunk_index INT DEFAULT 0,
    chunk_text LONGTEXT NOT NULL,
    chunk_token_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chunk_source (source_platform, original_record_id),
    INDEX idx_chunk_file (file_id),
    FULLTEXT INDEX ft_chunk_search (chunk_text, filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- AI CONVERSATIONS, MESSAGES & SEARCH HISTORY
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) DEFAULT 'New Conversation',
    model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender ENUM('user', 'assistant', 'system') NOT NULL,
    content LONGTEXT NOT NULL,
    function_calls_json JSON,
    function_results_json JSON,
    citations_json JSON,
    token_usage_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_query_sources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    source_platform ENUM('whatsapp', 'gmail', 'drive') NOT NULL,
    record_id VARCHAR(150) NOT NULL,
    record_type VARCHAR(100),
    title VARCHAR(255),
    snippet TEXT,
    relevance_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_search_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    query_text TEXT NOT NULL,
    platforms_searched VARCHAR(100),
    execution_time_ms INT DEFAULT 0,
    results_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
