import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { query } from '../../config/db.js';

class DocumentExtractor {
  /**
   * Extract plain text from a file buffer based on MIME type or file extension
   */
  async extractText(buffer, fileName, mimeType = '') {
    const ext = path.extname(fileName).toLowerCase();
    let text = '';
    let pageCount = 1;

    try {
      if (ext === '.pdf' || mimeType.includes('pdf')) {
        const data = await pdfParse(buffer);
        text = data.text || '';
        pageCount = data.numpages || 1;
      } else if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' || mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const lines = [];
        for (const sheetName of workbook.SheetNames) {
          lines.push(`--- Sheet: ${sheetName} ---`);
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          lines.push(csv);
        }
        text = lines.join('\n');
      } else if (
        ext === '.txt' ||
        ext === '.md' ||
        ext === '.json' ||
        ext === '.log' ||
        ext === '.html' ||
        mimeType.startsWith('text/')
      ) {
        text = buffer.toString('utf8');
      } else {
        // Fallback: try reading as UTF-8 string if reasonable, or note binary
        text = `[Binary file: ${fileName} (${mimeType || 'unknown format'})]`;
      }
    } catch (err) {
      console.warn(`[Extractor] Error parsing file ${fileName}:`, err.message);
      text = `[Extraction failed for ${fileName}: ${err.message}]`;
    }

    return {
      text: text.trim(),
      pageCount
    };
  }

  /**
   * Split text into overlapping windows
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    if (!text || text.trim().length === 0) return [];
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkStr = text.slice(start, end).trim();
      if (chunkStr.length > 0) {
        chunks.push({
          chunkIndex: chunks.length,
          text: chunkStr,
          tokenEstimate: Math.ceil(chunkStr.length / 4)
        });
      }
      if (end >= text.length) break;
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Ingest and index a document into document_chunks table
   */
  async processAndIndexDocument({
    sourcePlatform,
    originalRecordId,
    fileId,
    fileName,
    senderOrOwner,
    timestamp,
    buffer,
    mimeType
  }) {
    const { text, pageCount } = await this.extractText(buffer, fileName, mimeType);
    if (!text || text.length === 0) return { chunksCount: 0, textLength: 0 };

    const chunks = this.chunkText(text, 1000, 200);

    // Delete existing chunks for this file if resyncing
    await query(
      `DELETE FROM document_chunks 
       WHERE source_platform = ? AND file_id = ?`,
      [sourcePlatform, String(fileId || originalRecordId)]
    );

    for (const chunk of chunks) {
      await query(
        `INSERT INTO document_chunks (
          source_platform, original_record_id, file_id, filename,
          sender_or_owner, timestamp, page_number, chunk_index,
          chunk_text, chunk_token_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sourcePlatform,
          originalRecordId || null,
          String(fileId || originalRecordId),
          fileName,
          senderOrOwner || null,
          timestamp ? new Date(timestamp) : new Date(),
          Math.max(1, Math.min(pageCount, Math.floor(chunk.chunkIndex / 2) + 1)),
          chunk.chunkIndex,
          chunk.text,
          chunk.tokenEstimate
        ]
      );
    }

    return {
      chunksCount: chunks.length,
      textLength: text.length,
      extractedText: text
    };
  }
}

export const documentExtractor = new DocumentExtractor();
export default documentExtractor;
