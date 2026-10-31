import fs from 'fs';
import path from 'path';
import { query } from '../config/db.js';
import reportGenerator from '../services/reports/reportGenerator.js';
import logger from '../utils/logger.js';

export async function generateReport(req, res) {
  const {
    templateType = 'contact_profile',
    contactId = null,
    entityId = null,
    topic = '',
    customPrompt = '',
    format = 'pdf',
    provider = 'gemini',
    model = null
  } = req.body;

  try {
    logger.info('reports', `Generating report type: ${templateType}, format: ${format}, target: ${topic || contactId}`);

    // 1. Synthesize report content using active AI provider
    const reportData = await reportGenerator.generateReportContent({
      templateType,
      contactId,
      entityId,
      topic,
      customPrompt,
      provider,
      model
    });

    // 2. Export to requested format
    const cleanSafeTitle = (reportData.title || 'report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const filename = `${cleanSafeTitle}_${Date.now()}.${format.toLowerCase()}`;
    let exportResult;

    const fmt = format.toLowerCase();
    if (fmt === 'docx') {
      exportResult = await reportGenerator.exportToDOCX(reportData, filename);
    } else if (fmt === 'xlsx') {
      exportResult = await reportGenerator.exportToXLSX(reportData, filename);
    } else if (fmt === 'csv') {
      exportResult = await reportGenerator.exportToCSV(reportData, filename);
    } else {
      // default: pdf
      exportResult = await reportGenerator.exportToPDF(reportData, filename);
    }

    // Relative path for database
    const relativeFilePath = path.join('reports', filename);

    // 3. Save into generated_reports table
    const result = await query(
      `INSERT INTO generated_reports 
        (user_id, report_type, title, summary, content_markdown, content_json, format, file_path, file_size_bytes, sources_json, entity_id, contact_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || 1,
        templateType,
        reportData.title,
        reportData.summary,
        reportData.markdown,
        JSON.stringify({
          targetName: reportData.targetName,
          provider,
          model,
          customPrompt
        }),
        fmt,
        relativeFilePath,
        exportResult.sizeBytes,
        JSON.stringify({
          whatsappCount: reportData.evidence?.messages?.length || 0,
          gmailCount: reportData.evidence?.emails?.length || 0,
          driveCount: reportData.evidence?.files?.length || 0
        }),
        entityId,
        contactId
      ]
    );

    const reportId = result.insertId;

    return res.status(201).json({
      success: true,
      report: {
        id: reportId,
        reportType: templateType,
        title: reportData.title,
        summary: reportData.summary,
        format: fmt,
        markdown: reportData.markdown,
        filePath: relativeFilePath,
        fileSizeBytes: exportResult.sizeBytes,
        downloadUrl: `/api/reports/${reportId}/download`,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('reports', 'Report generation failed', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function listReports(req, res) {
  const { limit = 50, offset = 0, format, type, q } = req.query;

  try {
    let sql = `
      SELECT 
        gr.id, gr.report_type, gr.title, gr.summary, gr.format, 
        gr.file_path, gr.file_size_bytes, gr.sources_json, 
        gr.entity_id, gr.contact_id, gr.created_at,
        c.display_name as contact_name
      FROM generated_reports gr
      LEFT JOIN contacts c ON gr.contact_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (format) {
      sql += ` AND gr.format = ?`;
      params.push(format.toLowerCase());
    }
    if (type) {
      sql += ` AND gr.report_type = ?`;
      params.push(type);
    }
    if (q) {
      sql += ` AND (gr.title LIKE ? OR gr.summary LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY gr.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await query(sql, params);

    return res.json({
      success: true,
      reports: rows.map(r => ({
        id: r.id,
        reportType: r.report_type,
        title: r.title,
        summary: r.summary,
        format: r.format,
        fileSizeBytes: r.file_size_bytes,
        contactName: r.contact_name,
        sources: r.sources_json ? JSON.parse(r.sources_json) : null,
        createdAt: r.created_at,
        downloadUrl: `/api/reports/${r.id}/download`,
        previewUrl: `/api/documents/report_${r.id}/preview`
      }))
    });
  } catch (error) {
    logger.error('reports', 'Failed to list reports', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getReport(req, res) {
  const { id } = req.params;
  try {
    const [row] = await query('SELECT * FROM generated_reports WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    return res.json({
      success: true,
      report: {
        id: row.id,
        reportType: row.report_type,
        title: row.title,
        summary: row.summary,
        format: row.format,
        markdown: row.content_markdown,
        metadata: row.content_json ? JSON.parse(row.content_json) : null,
        sources: row.sources_json ? JSON.parse(row.sources_json) : null,
        fileSizeBytes: row.file_size_bytes,
        createdAt: row.created_at,
        downloadUrl: `/api/reports/${row.id}/download`,
        previewUrl: `/api/documents/report_${row.id}/preview`
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function downloadReport(req, res) {
  const { id } = req.params;
  try {
    const [row] = await query('SELECT * FROM generated_reports WHERE id = ?', [id]);
    if (!row || !row.file_path) {
      return res.status(404).json({ success: false, error: 'Report file not found' });
    }

    const fullPath = path.resolve(reportGenerator.reportsDir, '..', row.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Report file does not exist on disk' });
    }

    const fmt = (row.format || 'pdf').toLowerCase();
    const mime = fmt === 'docx' 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : fmt === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : fmt === 'csv'
      ? 'text/csv'
      : 'application/pdf';

    const filename = `${row.title}.${fmt}`;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    logger.error('reports', `Download error for report #${id}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteReport(req, res) {
  const { id } = req.params;
  try {
    const [row] = await query('SELECT * FROM generated_reports WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    if (row.file_path) {
      try {
        const fullPath = path.resolve(reportGenerator.reportsDir, '..', row.file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch {}
    }

    await query('DELETE FROM generated_reports WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  generateReport,
  listReports,
  getReport,
  downloadReport,
  deleteReport
};
