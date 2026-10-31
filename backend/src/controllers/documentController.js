import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { query } from '../config/db.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Determine high-level file type from mime type or file extension
 */
function classifyFileType(mimeType = '', filename = '') {
  const ext = path.extname(filename || '').toLowerCase();
  const m = (mimeType || '').toLowerCase();

  if (m.includes('pdf') || ext === '.pdf') return 'pdf';
  if (
    m.includes('wordprocessingml') ||
    m.includes('msword') ||
    ext === '.docx' ||
    ext === '.doc'
  ) return 'docx';
  if (
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    ext === '.xlsx' ||
    ext === '.xls' ||
    ext === '.csv'
  ) return 'spreadsheet';
  if (
    m.includes('presentation') ||
    m.includes('powerpoint') ||
    ext === '.pptx' ||
    ext === '.ppt'
  ) return 'pptx';
  if (
    m.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)
  ) return 'image';
  if (
    m.startsWith('text/') ||
    ['.txt', '.md', '.json', '.xml', '.html', '.js', '.ts', '.log'].includes(ext)
  ) return 'text';
  if (
    m.includes('zip') ||
    m.includes('compressed') ||
    ['.zip', '.rar', '.tar', '.gz', '.7z'].includes(ext)
  ) return 'archive';

  return 'other';
}

/**
 * Parse document ID (e.g. "drive_5", "gmail_2", "whatsapp_3", "report_1")
 */
function parseDocId(compoundId) {
  if (typeof compoundId === 'number' || /^\d+$/.test(compoundId)) {
    return { source: 'drive', id: parseInt(compoundId, 10) };
  }
  const parts = String(compoundId).split('_');
  if (parts.length >= 2) {
    const source = parts[0];
    const id = parseInt(parts.slice(1).join('_'), 10);
    return { source, id };
  }
  return { source: 'unknown', id: null };
}

/**
 * Verify a local path is within allowed storage boundaries
 */
function resolveSafePath(relativePath) {
  if (!relativePath) return null;
  const storageRoot = path.resolve(config.storage.rootPath);
  const resolved = path.resolve(storageRoot, relativePath);
  if (!resolved.startsWith(storageRoot)) {
    logger.warn('security', `Path traversal attempt prevented: ${relativePath}`);
    return null;
  }
  return resolved;
}

/**
 * Unified list of documents across all connected platforms & generated reports
 */
export async function getDocuments(req, res) {
  const {
    q = '',
    source = 'all',
    fileType = 'all',
    limit = 50,
    offset = 0,
    sortBy = 'date_desc'
  } = req.query;

  try {
    const documents = [];

    // 1. Google Drive Files
    if (source === 'all' || source === 'drive') {
      try {
        let driveSql = `
          SELECT 
            id, name, mime_type, size_bytes, 
            local_file_path, web_view_link, 
            drive_modified_time, owners_json 
          FROM drive_files 
          WHERE is_trashed = false
        `;
        const driveParams = [];
        if (q) {
          driveSql += ` AND name LIKE ?`;
          driveParams.push(`%${q}%`);
        }
        driveSql += ` ORDER BY drive_modified_time DESC LIMIT 100`;
        const driveRows = await query(driveSql, driveParams);

        for (const row of driveRows) {
          const type = classifyFileType(row.mime_type, row.name);
          if (fileType !== 'all' && type !== fileType) continue;

          let ownerName = 'Google Drive';
          if (row.owners_json) {
            try {
              const owners = typeof row.owners_json === 'string' ? JSON.parse(row.owners_json) : row.owners_json;
              if (Array.isArray(owners) && owners[0]?.displayName) {
                ownerName = owners[0].displayName;
              }
            } catch {}
          }

          let localExists = false;
          if (row.local_file_path) {
            const p = resolveSafePath(row.local_file_path);
            if (p && fs.existsSync(p)) localExists = true;
          }

          documents.push({
            id: `drive_${row.id}`,
            numericId: row.id,
            source: 'drive',
            name: row.name,
            mimeType: row.mime_type || 'application/octet-stream',
            fileType: type,
            sizeBytes: row.size_bytes || 0,
            timestamp: row.drive_modified_time,
            associatedContact: ownerName,
            localAvailable: localExists,
            hasPreview: localExists || ['pdf', 'spreadsheet', 'docx', 'text'].includes(type),
            webLink: row.web_view_link,
            downloadUrl: `/api/documents/drive_${row.id}/download`,
            previewUrl: `/api/documents/drive_${row.id}/preview`
          });
        }
      } catch (err) {
        logger.warn('documents', `Error fetching drive documents: ${err.message}`);
      }
    }

    // 2. Gmail Attachments
    if (source === 'all' || source === 'gmail') {
      try {
        let gmailSql = `
          SELECT 
            ea.id, ea.original_filename, ea.mime_type, ea.file_size, 
            ea.file_path, ea.created_at,
            e.subject, e.sender_name, e.sender_email
          FROM email_attachments ea
          LEFT JOIN emails e ON ea.email_id = e.id
          WHERE 1=1
        `;
        const gmailParams = [];
        if (q) {
          gmailSql += ` AND (ea.original_filename LIKE ? OR e.subject LIKE ?)`;
          gmailParams.push(`%${q}%`, `%${q}%`);
        }
        gmailSql += ` ORDER BY ea.created_at DESC LIMIT 100`;
        const gmailRows = await query(gmailSql, gmailParams);

        for (const row of gmailRows) {
          const type = classifyFileType(row.mime_type, row.original_filename);
          if (fileType !== 'all' && type !== fileType) continue;

          let localExists = false;
          if (row.file_path) {
            const p = resolveSafePath(row.file_path);
            if (p && fs.existsSync(p)) localExists = true;
          }

          documents.push({
            id: `gmail_${row.id}`,
            numericId: row.id,
            source: 'gmail',
            name: row.original_filename,
            mimeType: row.mime_type || 'application/octet-stream',
            fileType: type,
            sizeBytes: row.file_size || 0,
            timestamp: row.created_at,
            associatedContact: row.sender_name || row.sender_email || 'Gmail Attachment',
            contextTitle: row.subject,
            localAvailable: localExists,
            hasPreview: localExists,
            downloadUrl: `/api/documents/gmail_${row.id}/download`,
            previewUrl: `/api/documents/gmail_${row.id}/preview`
          });
        }
      } catch (err) {
        logger.warn('documents', `Error fetching gmail attachments: ${err.message}`);
      }
    }

    // 3. WhatsApp Attachments / Media
    if (source === 'all' || source === 'whatsapp') {
      try {
        let waSql = `
          SELECT 
            wa.id, wa.original_filename, wa.mime_type, wa.file_size,
            wa.file_path, wa.created_at,
            wm.chat_jid, wm.sender_name, COALESCE(wm.text_content, wm.caption, '') as body,
            wc.chat_name
          FROM wa_attachments wa
          LEFT JOIN wa_messages wm ON wa.message_id = wm.id
          LEFT JOIN wa_chats wc ON wm.chat_jid = wc.chat_jid
          WHERE 1=1
        `;
        const waParams = [];
        if (q) {
          waSql += ` AND (wa.original_filename LIKE ? OR wm.text_content LIKE ? OR wm.caption LIKE ?)`;
          waParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        waSql += ` ORDER BY wa.created_at DESC LIMIT 100`;
        const waRows = await query(waSql, waParams);

        for (const row of waRows) {
          const type = classifyFileType(row.mime_type, row.original_filename);
          if (fileType !== 'all' && type !== fileType) continue;

          let localExists = false;
          if (row.file_path) {
            const p = resolveSafePath(row.file_path);
            if (p && fs.existsSync(p)) localExists = true;
          }

          documents.push({
            id: `whatsapp_${row.id}`,
            numericId: row.id,
            source: 'whatsapp',
            name: row.original_filename || `WhatsApp Media #${row.id}`,
            mimeType: row.mime_type || 'application/octet-stream',
            fileType: type,
            sizeBytes: row.file_size || 0,
            timestamp: row.created_at,
            associatedContact: row.chat_name || row.sender_name || 'WhatsApp Contact',
            localAvailable: localExists,
            hasPreview: localExists,
            downloadUrl: `/api/documents/whatsapp_${row.id}/download`,
            previewUrl: `/api/documents/whatsapp_${row.id}/preview`
          });
        }
      } catch (err) {
        logger.warn('documents', `Error fetching whatsapp attachments: ${err.message}`);
      }
    }

    // 4. Generated Reports
    if (source === 'all' || source === 'report') {
      try {
        let rptSql = `
          SELECT 
            id, report_type, title, summary, 
            format, file_path, file_size_bytes, created_at
          FROM generated_reports
          WHERE 1=1
        `;
        const rptParams = [];
        if (q) {
          rptSql += ` AND (title LIKE ? OR summary LIKE ?)`;
          rptParams.push(`%${q}%`, `%${q}%`);
        }
        rptSql += ` ORDER BY created_at DESC LIMIT 100`;
        const rptRows = await query(rptSql, rptParams);

        for (const row of rptRows) {
          const fmt = (row.format || 'pdf').toLowerCase();
          const ext = fmt === 'docx' ? '.docx' : fmt === 'xlsx' ? '.xlsx' : fmt === 'csv' ? '.csv' : '.pdf';
          const mime = fmt === 'docx' 
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : fmt === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : fmt === 'csv'
            ? 'text/csv'
            : 'application/pdf';

          const type = fmt === 'docx' ? 'docx' : (fmt === 'xlsx' || fmt === 'csv') ? 'spreadsheet' : 'pdf';
          if (fileType !== 'all' && type !== fileType) continue;

          let localExists = false;
          if (row.file_path) {
            const p = resolveSafePath(row.file_path);
            if (p && fs.existsSync(p)) localExists = true;
          }

          documents.push({
            id: `report_${row.id}`,
            numericId: row.id,
            source: 'report',
            name: `${row.title}${row.title.endsWith(ext) ? '' : ext}`,
            mimeType: mime,
            fileType: type,
            sizeBytes: row.file_size_bytes || 0,
            timestamp: row.created_at,
            associatedContact: 'AI Generated Dossier',
            contextTitle: row.summary,
            localAvailable: localExists,
            hasPreview: true,
            downloadUrl: `/api/documents/report_${row.id}/download`,
            previewUrl: `/api/documents/report_${row.id}/preview`
          });
        }
      } catch (err) {
        logger.warn('documents', `Error fetching generated reports: ${err.message}`);
      }
    }

    // Sort documents
    documents.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'size_desc') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      if (sortBy === 'date_asc') return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
      // default: date_desc
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    // Pagination
    const totalCount = documents.length;
    const paginated = documents.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));

    return res.json({
      success: true,
      total: totalCount,
      count: paginated.length,
      documents: paginated
    });
  } catch (error) {
    logger.error('documents', 'Failed to retrieve documents', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Return summary statistics across all documents
 */
export async function getDocumentStats(req, res) {
  try {
    const [drive] = await query('SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as bytes FROM drive_files WHERE is_trashed = false');
    const [gmail] = await query('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as bytes FROM email_attachments');
    const [wa] = await query('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as bytes FROM wa_attachments');
    const [reports] = await query('SELECT COUNT(*) as count, COALESCE(SUM(file_size_bytes), 0) as bytes FROM generated_reports');

    const totalCount = (drive?.count || 0) + (gmail?.count || 0) + (wa?.count || 0) + (reports?.count || 0);
    const totalBytes = Number(drive?.bytes || 0) + Number(gmail?.bytes || 0) + Number(wa?.bytes || 0) + Number(reports?.bytes || 0);

    return res.json({
      success: true,
      stats: {
        totalCount,
        totalBytes,
        bySource: {
          drive: { count: drive?.count || 0, bytes: Number(drive?.bytes || 0) },
          gmail: { count: gmail?.count || 0, bytes: Number(gmail?.bytes || 0) },
          whatsapp: { count: wa?.count || 0, bytes: Number(wa?.bytes || 0) },
          reports: { count: reports?.count || 0, bytes: Number(reports?.bytes || 0) }
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * In-app rich preview payload for a document
 */
export async function previewDocument(req, res) {
  const { docId } = req.params;
  const { format, stream } = req.query;

  try {
    const { source, id } = parseDocId(docId);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid document ID format' });
    }

    let filePath = null;
    let fileName = '';
    let mimeType = '';
    let reportMarkdown = null;

    if (source === 'drive') {
      const [row] = await query('SELECT * FROM drive_files WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'Drive file not found' });
      filePath = row.local_file_path;
      fileName = row.name;
      mimeType = row.mime_type;
    } else if (source === 'gmail') {
      const [row] = await query('SELECT * FROM email_attachments WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'Gmail attachment not found' });
      filePath = row.file_path;
      fileName = row.original_filename;
      mimeType = row.mime_type;
    } else if (source === 'whatsapp') {
      const [row] = await query('SELECT * FROM wa_attachments WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'WhatsApp media not found' });
      filePath = row.file_path;
      fileName = row.original_filename;
      mimeType = row.mime_type;
    } else if (source === 'report') {
      const [row] = await query('SELECT * FROM generated_reports WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'Report not found' });
      filePath = row.file_path;
      fileName = `${row.title}.${row.format || 'pdf'}`;
      mimeType = row.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
      reportMarkdown = row.content_markdown;
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported document source' });
    }

    // If report has markdown and client didn't ask for raw binary stream, return markdown immediately
    if (source === 'report' && reportMarkdown && stream !== 'true') {
      return res.json({
        success: true,
        type: 'markdown',
        fileName,
        mimeType,
        markdown: reportMarkdown
      });
    }

    // Check if local file exists
    const fullPath = resolveSafePath(filePath);
    if (!fullPath || !fs.existsSync(fullPath)) {
      // Fallback: check document_chunks for extracted content
      const chunks = await query(
        'SELECT chunk_text FROM document_chunks WHERE source_platform = ? AND file_id = ? ORDER BY chunk_index ASC LIMIT 20',
        [source, id]
      );
      if (chunks && chunks.length > 0) {
        return res.json({
          success: true,
          type: 'text',
          fileName,
          mimeType,
          isExtractedChunk: true,
          content: chunks.map(c => c.chunk_text).join('\n\n')
        });
      }

      return res.status(404).json({
        success: false,
        error: 'File content is not stored locally. It can be viewed via web link if available.',
        fileName
      });
    }

    // If binary streaming requested (e.g. for PDF viewer embed or image src)
    if (stream === 'true') {
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      return fs.createReadStream(fullPath).pipe(res);
    }

    const type = classifyFileType(mimeType, fileName);

    // 1. Spreadsheet Preview (XLSX / CSV / XLS)
    if (type === 'spreadsheet') {
      const buffer = fs.readFileSync(fullPath);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetsData = {};

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // Convert to array of arrays (headers + rows)
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        // Limit preview to first 100 rows for high responsiveness
        sheetsData[sheetName] = {
          totalRows: jsonData.length,
          previewRows: jsonData.slice(0, 100)
        };
      }

      return res.json({
        success: true,
        type: 'spreadsheet',
        fileName,
        mimeType,
        sheetNames: workbook.SheetNames,
        sheets: sheetsData
      });
    }

    // 2. DOCX Word Document Preview
    if (type === 'docx') {
      const result = await mammoth.convertToHtml({ path: fullPath });
      return res.json({
        success: true,
        type: 'docx',
        fileName,
        mimeType,
        html: result.value,
        warnings: result.messages
      });
    }

    // 3. PDF Document Preview
    if (type === 'pdf') {
      const dataBuffer = fs.readFileSync(fullPath);
      let pageCount = 1;
      let textSample = '';
      try {
        const parsed = await pdfParse(dataBuffer);
        pageCount = parsed.numpages || 1;
        textSample = parsed.text ? parsed.text.slice(0, 3000) : '';
      } catch {}

      return res.json({
        success: true,
        type: 'pdf',
        fileName,
        mimeType,
        pageCount,
        textSample,
        streamUrl: `/api/documents/${docId}/preview?stream=true`
      });
    }

    // 4. Image Preview
    if (type === 'image') {
      return res.json({
        success: true,
        type: 'image',
        fileName,
        mimeType,
        streamUrl: `/api/documents/${docId}/preview?stream=true`
      });
    }

    // 5. Plain Text / Markdown / Code Preview
    if (type === 'text') {
      const content = fs.readFileSync(fullPath, 'utf8');
      return res.json({
        success: true,
        type: 'text',
        fileName,
        mimeType,
        content: content.slice(0, 100000) // 100KB preview max
      });
    }

    // Fallback: Default text summary
    const stats = fs.statSync(fullPath);
    return res.json({
      success: true,
      type: 'generic',
      fileName,
      mimeType,
      sizeBytes: stats.size,
      downloadUrl: `/api/documents/${docId}/download`
    });

  } catch (error) {
    logger.error('documents', `Error generating preview for ${req.params.docId}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Secure file download with proper attachment headers
 */
export async function downloadDocument(req, res) {
  const { docId } = req.params;

  try {
    const { source, id } = parseDocId(docId);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid document ID format' });
    }

    let filePath = null;
    let fileName = 'download';
    let mimeType = 'application/octet-stream';

    if (source === 'drive') {
      const [row] = await query('SELECT * FROM drive_files WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'File not found' });
      filePath = row.local_file_path;
      fileName = row.name;
      mimeType = row.mime_type;
    } else if (source === 'gmail') {
      const [row] = await query('SELECT * FROM email_attachments WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'File not found' });
      filePath = row.file_path;
      fileName = row.original_filename;
      mimeType = row.mime_type;
    } else if (source === 'whatsapp') {
      const [row] = await query('SELECT * FROM wa_attachments WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'File not found' });
      filePath = row.file_path;
      fileName = row.original_filename;
      mimeType = row.mime_type;
    } else if (source === 'report') {
      const [row] = await query('SELECT * FROM generated_reports WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'File not found' });
      filePath = row.file_path;
      fileName = `${row.title}.${row.format || 'pdf'}`;
      mimeType = row.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
    }

    const fullPath = resolveSafePath(filePath);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'File is not available on local storage' });
    }

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    return fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    logger.error('documents', `Download failed for ${req.params.docId}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getDocuments,
  getDocumentStats,
  previewDocument,
  downloadDocument
};
