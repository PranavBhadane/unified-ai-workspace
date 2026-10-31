import entityResolver from '../services/entities/entityResolver.js';
import { query } from '../config/db.js';

export async function getEntities(req, res) {
  const { q, limit = 50 } = req.query;
  const userId = req.user?.id || 1;
  try {
    let sql = `SELECT * FROM entities WHERE user_id = ?`;
    const params = [userId];
    if (q) {
      sql += ` AND (primary_name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY confidence_score DESC, updated_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const rows = await query(sql, params);
    return res.json({ success: true, entities: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEntity(req, res) {
  const { id } = req.params;
  try {
    const profile = await entityResolver.getClientProfile(id);
    return res.json({ success: true, profile });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEntityTimeline(req, res) {
  const { id } = req.params;
  try {
    const timeline = await entityResolver.getClientTimeline(id);
    return res.json({ success: true, timeline });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEntityDocuments(req, res) {
  const { id } = req.params;
  try {
    const profile = await entityResolver.getClientProfile(id);
    return res.json({
      success: true,
      documents: profile.driveFiles || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function triggerCorrelation(req, res) {
  const userId = req.user?.id || 1;
  try {
    const result = await entityResolver.autoCorrelateEntities(userId);
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getEntities,
  getEntity,
  getEntityTimeline,
  getEntityDocuments,
  triggerCorrelation
};
