import logger from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'unknown-req';
  const durationMs = req.startTime ? Date.now() - req.startTime : 0;
  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : (statusCode === 401 ? 'UNAUTHORIZED' : (statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR')));

  // Sanitize message to avoid leaking keys or internal paths
  let safeMessage = err.message || 'An unexpected internal error occurred.';
  if (safeMessage.includes('key=') || safeMessage.includes('password') || safeMessage.includes('secret')) {
    safeMessage = 'A service error occurred while processing sensitive authentication data.';
  }

  // Log error
  logger.error(req.moduleName || 'system', 'request_error', safeMessage, {
    requestId,
    status: String(statusCode),
    durationMs,
    details: {
      code: errorCode,
      url: req.originalUrl || req.url,
      method: req.method
    },
    error: err
  });

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: safeMessage,
      details: process.env.NODE_ENV === 'development' ? err.details || err.message : undefined,
      requestId
    }
  });
}

export default errorHandler;
