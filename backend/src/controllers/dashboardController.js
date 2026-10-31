import { query } from '../config/db.js';
import storageManager from '../services/storage/storageManager.js';

export async function getKPIs(req, res) {
  try {
    const [waCount] = await query(`SELECT COUNT(*) as count FROM wa_messages`);
    const [gmailCount] = await query(`SELECT COUNT(*) as count FROM emails`);
    const [driveCount] = await query(`SELECT COUNT(*) as count FROM drive_files WHERE is_trashed = false`);
    const [connCount] = await query(`SELECT COUNT(*) as count FROM connected_accounts WHERE status = 'connected'`);
    const [chunkCount] = await query(`SELECT COUNT(*) as count FROM document_chunks`);
    const [entityCount] = await query(`SELECT COUNT(*) as count FROM entities`);

    const storageStats = storageManager.getStorageStats();

    return res.json({
      success: true,
      kpis: {
        whatsappMessages: waCount.count || 0,
        gmailEmails: gmailCount.count || 0,
        driveFiles: driveCount.count || 0,
        connectedPlatforms: connCount.count || 0,
        indexedChunks: chunkCount.count || 0,
        entitiesCount: entityCount.count || 0,
        storageBytes: storageStats.totalBytes || 0,
        storageFormatted: `${(storageStats.totalBytes / (1024 * 1024)).toFixed(2)} MB`
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRecentActivity(req, res) {
  try {
    const recentSyncs = await query(`
      SELECT j.id, j.platform, j.job_type, j.status, j.records_processed, j.created_at
      FROM sync_jobs j
      ORDER BY j.created_at DESC
      LIMIT 5
    `);

    const recentAi = await query(`
      SELECT id, title, updated_at
      FROM ai_conversations
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    const recentFiles = await query(`
      SELECT id, file_id, name, mime_type, drive_modified_time, web_view_link
      FROM drive_files
      WHERE is_trashed = false
      ORDER BY drive_modified_time DESC
      LIMIT 5
    `);

    return res.json({
      success: true,
      recentSyncs,
      recentAi,
      recentFiles
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getDocuments(req, res) {
  const { q, platform, limit = 50, offset = 0 } = req.query;
  try {
    let sql = `
      SELECT 
        d.id,
        d.file_id,
        d.name as filename,
        d.mime_type,
        d.size_bytes,
        d.web_view_link,
        d.drive_modified_time as timestamp,
        'drive' as source_platform
      FROM drive_files d
      WHERE d.is_trashed = false
    `;
    const params = [];

    if (q) {
      sql += ` AND d.name LIKE ?`;
      params.push(`%${q}%`);
    }

    sql += ` ORDER BY d.drive_modified_time DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await query(sql, params);
    return res.json({ success: true, documents: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getKPIs,
  getRecentActivity,
  getDocuments
};
