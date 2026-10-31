import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

export function requestIdMiddleware(req, res, next) {
  // Use incoming X-Request-Id if provided, or generate new UUID
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);

  // Attach convenient logger on request object
  req.log = {
    info: (action, message, meta = {}) => logger.info(req.moduleName || 'http', action, message, { requestId, ...meta }),
    warn: (action, message, meta = {}) => logger.warn(req.moduleName || 'http', action, message, { requestId, ...meta }),
    error: (action, message, meta = {}) => logger.error(req.moduleName || 'http', action, message, { requestId, ...meta }),
    debug: (action, message, meta = {}) => logger.debug(req.moduleName || 'http', action, message, { requestId, ...meta })
  };

  // Log response when completed
  res.on('finish', () => {
    const durationMs = Date.now() - req.startTime;
    const level = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');
    logger.log({
      level,
      module: 'http',
      action: `${req.method} ${req.baseUrl || ''}${req.path}`,
      message: `HTTP ${res.statusCode} ${req.method} ${req.originalUrl || req.url}`,
      requestId,
      status: String(res.statusCode),
      durationMs,
      details: {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent']
      }
    });
  });

  next();
}

export default requestIdMiddleware;
