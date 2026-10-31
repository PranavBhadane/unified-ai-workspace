import { query } from '../config/db.js';
import searchEngine from '../services/search/searchEngine.js';

export async function getMessages(req, res) {
  const { limit = 50, offset = 0, q } = req.query;
  try {
    let sql = `SELECT * FROM emails`;
    const params = [];
    if (q) {
      sql += ` WHERE subject LIKE ? OR snippet LIKE ? OR sender_email LIKE ? OR sender_name LIKE ?`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY internal_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await query(sql, params);
    return res.json({ success: true, emails: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getThreads(req, res) {
  const { limit = 50 } = req.query;
  try {
    const rows = await query(`
      SELECT t.*, COUNT(e.id) as message_count
      FROM email_threads t
      LEFT JOIN emails e ON t.thread_id = e.thread_id
      GROUP BY t.id
      ORDER BY t.last_message_date DESC
      LIMIT ?
    `, [parseInt(limit, 10)]);
    return res.json({ success: true, threads: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function searchEmails(req, res) {
  const { q, limit = 20 } = req.query;
  if (!q) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" required' });
  }
  try {
    const results = await searchEngine.searchGmail({ q, limit: parseInt(limit, 10) });
    return res.json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getMessages,
  getThreads,
  searchEmails
};
