import { query } from '../config/db.js';
import logger from '../utils/logger.js';

export async function getLogs(req, res) {
  const {
    level,
    module: mod,
    requestId,
    q,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0
  } = req.query;

  try {
    let sql = `SELECT * FROM system_logs WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM system_logs WHERE 1=1`;
    const params = [];
    const countParams = [];

    if (level) {
      sql += ` AND log_level = ?`;
      countSql += ` AND log_level = ?`;
      params.push(level);
      countParams.push(level);
    }
    if (mod) {
      sql += ` AND module = ?`;
      countSql += ` AND module = ?`;
      params.push(mod);
      countParams.push(mod);
    }
    if (requestId) {
      sql += ` AND request_id LIKE ?`;
      countSql += ` AND request_id LIKE ?`;
      params.push(`%${requestId}%`);
      countParams.push(`%${requestId}%`);
    }
    if (q) {
      sql += ` AND (message LIKE ? OR action LIKE ?)`;
      countSql += ` AND (message LIKE ? OR action LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
      countParams.push(`%${q}%`, `%${q}%`);
    }
    if (dateFrom) {
      sql += ` AND created_at >= ?`;
      countSql += ` AND created_at >= ?`;
      params.push(new Date(dateFrom));
      countParams.push(new Date(dateFrom));
    }
    if (dateTo) {
      sql += ` AND created_at <= ?`;
      countSql += ` AND created_at <= ?`;
      params.push(new Date(dateTo));
      countParams.push(new Date(dateTo));
    }

    sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows, totalRes] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = totalRes[0]?.total || 0;

    return res.json({
      success: true,
      logs: rows,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error) {
    logger.error('logs', 'get_logs_error', error.message, { error, requestId: req.requestId });
    return res.status(500).json({
      success: false,
      error: { code: 'LOGS_RETRIEVAL_FAILED', message: error.message, requestId: req.requestId }
    });
  }
}

export async function clearLogs(req, res) {
  const { confirm } = req.body;
  if (!confirm) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONFIRMATION_REQUIRED', message: 'Explicit confirmation required to clear system logs.' }
    });
  }

  try {
    await query(`TRUNCATE TABLE system_logs`);
    logger.info('logs', 'clear_logs', 'All system logs cleared by user request.', { requestId: req.requestId });
    return res.json({ success: true, message: 'All system logs cleared successfully.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'LOGS_CLEAR_FAILED', message: error.message, requestId: req.requestId }
    });
  }
}

export async function exportLogs(req, res) {
  const { format = 'json' } = req.query;
  try {
    const logs = await query(`SELECT * FROM system_logs ORDER BY id DESC LIMIT 5000`);

    if (format === 'csv') {
      const headers = ['id', 'created_at', 'log_level', 'module', 'action', 'message', 'status', 'duration_ms', 'request_id'];
      const rows = logs.map(l => headers.map(h => {
        let val = l[h] === null || l[h] === undefined ? '' : String(l[h]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','));
      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="system_logs_${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="system_logs_${Date.now()}.json"`);
    return res.send(JSON.stringify(logs, null, 2));
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'LOGS_EXPORT_FAILED', message: error.message, requestId: req.requestId }
    });
  }
}

export default {
  getLogs,
  clearLogs,
  exportLogs
};
