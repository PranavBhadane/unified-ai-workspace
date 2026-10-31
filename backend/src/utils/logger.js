import { query } from '../config/db.js';
import syncManager from '../services/sync/syncManager.js';

// Sensitive keys to redact
const SENSITIVE_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /credential/i,
  /cookie/i,
  /private/i
];

function sanitize(obj, depth = 0) {
  if (depth > 4) return '[Max Depth]';
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitize(item, depth + 1));

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(key));
    if (isSensitive) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value, depth + 1);
    } else if (typeof value === 'string' && value.length > 500) {
      clean[key] = value.substring(0, 500) + '... [truncated]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

class Logger {
  constructor() {
    this.buffer = [];
  }

  formatTerminal(level, module, action, message, requestId, durationMs) {
    const colors = {
      debug: '\x1b[90m', // gray
      info: '\x1b[36m',  // cyan
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      reset: '\x1b[0m'
    };
    const color = colors[level] || colors.info;
    const time = new Date().toISOString().substring(11, 23);
    const reqStr = requestId ? `[${requestId.substring(0, 8)}] ` : '';
    const durStr = durationMs !== undefined && durationMs !== null ? ` (${durationMs}ms)` : '';
    return `${colors.debug}${time}${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset} \x1b[35m[${module}]\x1b[0m \x1b[1m${action}\x1b[0m: ${reqStr}${message}${durStr}`;
  }

  async log({
    level = 'info',
    module = 'system',
    action = 'operation',
    message = '',
    requestId = null,
    status = null,
    durationMs = null,
    details = null,
    error = null
  }) {
    const errorStack = error ? (error.stack || String(error)) : null;
    const cleanDetails = details ? sanitize(details) : null;

    // Terminal log
    const termOutput = this.formatTerminal(level, module, action, message, requestId, durationMs);
    if (level === 'error') {
      console.error(termOutput);
      if (error && error.stack) console.error('\x1b[31m' + error.stack + '\x1b[0m');
    } else if (level === 'warn') {
      console.warn(termOutput);
    } else {
      console.log(termOutput);
    }

    // Broadcast log via Socket.IO for real-time Logs UI & DevTools console
    syncManager.broadcast('system:log', {
      id: Date.now(),
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      log_level: level,
      level,
      module,
      action,
      message,
      requestId,
      request_id: requestId,
      status,
      duration_ms: durationMs,
      durationMs,
      details_json: cleanDetails,
      details: cleanDetails,
      payload: cleanDetails,
      error_stack: errorStack,
      errorStack
    });

    // Asynchronously insert into database
    try {
      await query(
        `INSERT INTO system_logs (
          request_id, log_level, module, action, message, status, duration_ms, details_json, error_stack
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId || null,
          level,
          module,
          action,
          message,
          status || null,
          durationMs !== null ? durationMs : null,
          cleanDetails ? JSON.stringify(cleanDetails) : null,
          errorStack || null
        ]
      );
    } catch (dbErr) {
      // Don't crash logger if DB write fails
      console.error('[Logger DB Error]:', dbErr.message);
    }
  }

  info(module, action, message, meta = {}) {
    return this.log({ level: 'info', module, action, message, ...meta });
  }

  warn(module, action, message, meta = {}) {
    return this.log({ level: 'warn', module, action, message, ...meta });
  }

  error(module, action, message, meta = {}) {
    return this.log({ level: 'error', module, action, message, ...meta });
  }

  debug(module, action, message, meta = {}) {
    return this.log({ level: 'debug', module, action, message, ...meta });
  }
}

export const logger = new Logger();
export default logger;
