import { query } from '../config/db.js';
import searchEngine from '../services/search/searchEngine.js';

export async function getFiles(req, res) {
  const { limit = 50, offset = 0, q, mimeType } = req.query;
  try {
    let sql = `SELECT * FROM drive_files WHERE is_trashed = false`;
    const params = [];
    if (q) {
      sql += ` AND name LIKE ?`;
      params.push(`%${q}%`);
    }
    if (mimeType) {
      sql += ` AND mime_type LIKE ?`;
      params.push(`%${mimeType}%`);
    }
    sql += ` ORDER BY drive_modified_time DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await query(sql, params);
    return res.json({ success: true, files: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getFolders(req, res) {
  try {
    const rows = await query(`SELECT * FROM drive_folders ORDER BY name ASC LIMIT 100`);
    return res.json({ success: true, folders: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function searchDrive(req, res) {
  const { q, limit = 20 } = req.query;
  if (!q) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" required' });
  }
  try {
    const results = await searchEngine.searchDrive({ q, limit: parseInt(limit, 10) });
    return res.json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getFiles,
  getFolders,
  searchDrive
};
