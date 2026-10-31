-- UNIFIED AI WORKSPACE: Database Migration 002
-- Structured System & Audit Logs Table

CREATE TABLE IF NOT EXISTS system_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(64),
    log_level ENUM('debug', 'info', 'warn', 'error') DEFAULT 'info',
    module VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50),
    duration_ms INT DEFAULT NULL,
    details_json JSON,
    error_stack TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request_id (request_id),
    INDEX idx_log_level (log_level),
    INDEX idx_module (module),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
