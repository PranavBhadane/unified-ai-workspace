-- Migration 003: Multi-Provider AI Configuration, Reports Generation & Intelligent Dashboards

-- 1. AI Provider Configurations Table
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL UNIQUE,
  api_key_encrypted TEXT NULL,
  default_model VARCHAR(100) NULL,
  status VARCHAR(50) DEFAULT 'not_configured',
  status_message TEXT NULL,
  last_tested_at TIMESTAMP NULL,
  models_cache_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default provider configurations (Gemini configured by default from env)
INSERT INTO ai_provider_configs (provider, default_model, status, status_message)
VALUES
  ('gemini', 'gemini-3.1-flash-lite', 'configured', 'Configured via environment variable'),
  ('openai', 'gpt-4o', 'not_configured', 'API key required'),
  ('anthropic', 'claude-3-7-sonnet-20250219', 'not_configured', 'API key required')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 2. Add provider column to ai_conversations
ALTER TABLE ai_conversations ADD COLUMN provider VARCHAR(50) DEFAULT 'gemini';

-- 3. Add provider and model columns to ai_messages
ALTER TABLE ai_messages ADD COLUMN provider VARCHAR(50) DEFAULT 'gemini';
ALTER TABLE ai_messages ADD COLUMN model VARCHAR(100) NULL;

-- 4. Generated Reports Table
CREATE TABLE IF NOT EXISTS generated_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1,
  report_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NULL,
  content_markdown LONGTEXT NULL,
  content_json LONGTEXT NULL,
  format VARCHAR(20) DEFAULT 'pdf',
  file_path VARCHAR(500) NULL,
  file_size_bytes INT DEFAULT 0,
  sources_json LONGTEXT NULL,
  entity_id INT NULL,
  contact_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. AI Dashboards Table
CREATE TABLE IF NOT EXISTS ai_dashboards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  target_type VARCHAR(50) DEFAULT 'all',
  target_id VARCHAR(100) NULL,
  layout_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. AI Dashboard Widgets Table
CREATE TABLE IF NOT EXISTS ai_dashboard_widgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dashboard_id INT NOT NULL,
  widget_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  query_config_json LONGTEXT NULL,
  chart_config_json LONGTEXT NULL,
  grid_pos_json VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dashboard_id) REFERENCES ai_dashboards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
