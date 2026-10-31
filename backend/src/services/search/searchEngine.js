import { query } from '../../config/db.js';

class SearchEngine {
  /**
   * Normalize search text for Boolean Mode full-text queries
   */
  prepareFulltextQuery(searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') return '';
    // Strip special operators and create wildcard prefix tokens
    const words = searchTerm
      .replace(/[+\-><()~*\"@]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 1);
    
    if (words.length === 0) return searchTerm.trim();
    // E.g. "+word1* +word2*"
    return words.map(w => `+${w}*`).join(' ');
  }

  /**
   * Search WhatsApp messages
   */
  async searchWhatsApp({ q, limit = 20 }) {
    const ftQuery = this.prepareFulltextQuery(q);
    const likeQuery = `%${q}%`;

    const sql = `
      SELECT 
        'whatsapp' AS source_platform,
        m.id AS record_id,
        m.message_id,
        m.chat_jid,
        m.sender_name,
        m.sender_jid,
        m.message_type,
        m.text_content,
        m.caption,
        m.timestamp,
        m.media_path,
        c.name AS chat_name,
        (
          CASE 
            WHEN m.text_content LIKE ? OR m.caption LIKE ? THEN 5.0
            ELSE 0.0
          END
          + 
          (MATCH(m.text_content, m.caption) AGAINST(? IN BOOLEAN MODE))
        ) AS relevance_score
      FROM wa_messages m
      LEFT JOIN wa_chats c ON m.chat_jid = c.jid
      WHERE 
        (MATCH(m.text_content, m.caption) AGAINST(? IN BOOLEAN MODE)
        OR m.text_content LIKE ? 
        OR m.caption LIKE ?
        OR m.sender_name LIKE ?)
      ORDER BY relevance_score DESC, m.timestamp DESC
      LIMIT ?
    `;

    const rows = await query(sql, [
      likeQuery, likeQuery, ftQuery,
      ftQuery, likeQuery, likeQuery, likeQuery,
      limit
    ]);

    return rows.map(r => ({
      id: `wa_${r.record_id}`,
      platform: 'whatsapp',
      recordId: r.record_id,
      title: `WhatsApp from ${r.sender_name || r.sender_jid || r.chat_name || 'Contact'}`,
      snippet: r.text_content || r.caption || `[${r.message_type} media]`,
      date: new Date(Number(r.timestamp)).toISOString(),
      sender: r.sender_name || r.sender_jid,
      chat: r.chat_name || r.chat_jid,
      mediaPath: r.media_path,
      score: r.relevance_score
    }));
  }

  /**
   * Search Gmail messages
   */
  async searchGmail({ q, limit = 20 }) {
    const ftQuery = this.prepareFulltextQuery(q);
    const likeQuery = `%${q}%`;

    const sql = `
      SELECT 
        'gmail' AS source_platform,
        e.id AS record_id,
        e.message_id,
        e.thread_id,
        e.sender_name,
        e.sender_email,
        e.recipient_to,
        e.subject,
        e.snippet,
        e.body_plain,
        e.internal_date,
        (
          CASE 
            WHEN e.subject LIKE ? THEN 6.0
            WHEN e.sender_email LIKE ? OR e.sender_name LIKE ? THEN 4.0
            ELSE 0.0
          END
          + 
          (MATCH(e.subject, e.body_plain) AGAINST(? IN BOOLEAN MODE))
        ) AS relevance_score
      FROM emails e
      WHERE 
        (MATCH(e.subject, e.body_plain) AGAINST(? IN BOOLEAN MODE)
        OR e.subject LIKE ? 
        OR e.body_plain LIKE ?
        OR e.sender_name LIKE ?
        OR e.sender_email LIKE ?)
      ORDER BY relevance_score DESC, e.internal_date DESC
      LIMIT ?
    `;

    const rows = await query(sql, [
      likeQuery, likeQuery, likeQuery, ftQuery,
      ftQuery, likeQuery, likeQuery, likeQuery, likeQuery,
      limit
    ]);

    return rows.map(r => ({
      id: `gmail_${r.record_id}`,
      platform: 'gmail',
      recordId: r.record_id,
      threadId: r.thread_id,
      title: r.subject || '(No Subject)',
      snippet: r.snippet || (r.body_plain ? r.body_plain.substring(0, 200) : ''),
      date: r.internal_date ? new Date(Number(r.internal_date)).toISOString() : new Date().toISOString(),
      sender: `${r.sender_name || ''} <${r.sender_email}>`.trim(),
      score: r.relevance_score
    }));
  }

  /**
   * Search Google Drive files & extracted content
   */
  async searchDrive({ q, limit = 20 }) {
    const ftQuery = this.prepareFulltextQuery(q);
    const likeQuery = `%${q}%`;

    const sql = `
      SELECT 
        'drive' AS source_platform,
        f.id AS record_id,
        f.file_id,
        f.name,
        f.mime_type,
        f.size_bytes,
        f.web_view_link,
        f.drive_modified_time,
        c.raw_text,
        (
          CASE 
            WHEN f.name LIKE ? THEN 7.0
            ELSE 0.0
          END
          +
          (MATCH(f.name) AGAINST(? IN BOOLEAN MODE))
        ) AS relevance_score
      FROM drive_files f
      LEFT JOIN drive_file_contents c ON f.id = c.file_id
      WHERE 
        f.is_trashed = false AND
        (
          MATCH(f.name) AGAINST(? IN BOOLEAN MODE)
          OR f.name LIKE ?
          OR (c.raw_text IS NOT NULL AND MATCH(c.raw_text) AGAINST(? IN BOOLEAN MODE))
          OR c.raw_text LIKE ?
        )
      ORDER BY relevance_score DESC, f.drive_modified_time DESC
      LIMIT ?
    `;

    const rows = await query(sql, [
      likeQuery, ftQuery,
      ftQuery, likeQuery, ftQuery, likeQuery,
      limit
    ]);

    return rows.map(r => ({
      id: `drive_${r.record_id}`,
      platform: 'drive',
      recordId: r.record_id,
      fileId: r.file_id,
      title: r.name,
      mimeType: r.mime_type,
      webViewLink: r.web_view_link,
      snippet: r.raw_text ? r.raw_text.substring(0, 250) + '...' : `File: ${r.name}`,
      date: r.drive_modified_time ? new Date(r.drive_modified_time).toISOString() : new Date().toISOString(),
      score: r.relevance_score
    }));
  }

  /**
   * Search Document Chunks across all platforms
   */
  async searchChunks({ q, limit = 15 }) {
    const ftQuery = this.prepareFulltextQuery(q);
    const likeQuery = `%${q}%`;

    const sql = `
      SELECT 
        id,
        source_platform,
        original_record_id,
        file_id,
        filename,
        sender_or_owner,
        timestamp,
        page_number,
        chunk_index,
        chunk_text,
        MATCH(chunk_text, filename) AGAINST(? IN BOOLEAN MODE) AS score
      FROM document_chunks
      WHERE 
        MATCH(chunk_text, filename) AGAINST(? IN BOOLEAN MODE)
        OR chunk_text LIKE ?
        OR filename LIKE ?
      ORDER BY score DESC, timestamp DESC
      LIMIT ?
    `;

    const rows = await query(sql, [ftQuery, ftQuery, likeQuery, likeQuery, limit]);
    return rows.map(r => ({
      id: `chunk_${r.id}`,
      platform: r.source_platform,
      fileId: r.file_id,
      filename: r.filename,
      page: r.page_number,
      senderOrOwner: r.sender_or_owner,
      snippet: r.chunk_text,
      date: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      score: r.score
    }));
  }

  /**
   * Unified search across WhatsApp, Gmail, Drive, and Document Chunks
   */
  async searchAllSources({ q, platforms = ['whatsapp', 'gmail', 'drive'], limit = 25 }) {
    const results = [];
    const searchPromises = [];

    if (platforms.includes('whatsapp')) {
      searchPromises.push(this.searchWhatsApp({ q, limit }).catch(e => {
        console.warn('WhatsApp search failed:', e.message);
        return [];
      }));
    }
    if (platforms.includes('gmail')) {
      searchPromises.push(this.searchGmail({ q, limit }).catch(e => {
        console.warn('Gmail search failed:', e.message);
        return [];
      }));
    }
    if (platforms.includes('drive')) {
      searchPromises.push(this.searchDrive({ q, limit }).catch(e => {
        console.warn('Drive search failed:', e.message);
        return [];
      }));
    }

    searchPromises.push(this.searchChunks({ q, limit: 10 }).catch(e => {
      console.warn('Chunks search failed:', e.message);
      return [];
    }));

    const outputs = await Promise.all(searchPromises);
    outputs.forEach(items => results.push(...items));

    // Sort combined results by relevance score descending
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Deduplicate and cap to limit
    const seen = new Set();
    const unique = [];
    for (const item of results) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
      if (unique.length >= limit) break;
    }

    return unique;
  }
}

export const searchEngine = new SearchEngine();
export default searchEngine;
