import { query } from '../../config/db.js';

class EntityResolver {
  /**
   * Normalize phone number to pure digits, stripping country codes and spaces
   */
  normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    // If e.g. 919876543210 -> keep last 10 digits for local matching
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  /**
   * Normalize email address
   */
  normalizeEmail(email) {
    if (!email) return '';
    return String(email).trim().toLowerCase();
  }

  /**
   * Search known entities and aliases
   */
  async searchEntities(searchTerm, limit = 10) {
    const like = `%${searchTerm}%`;
    const sql = `
      SELECT DISTINCT 
        e.id, e.entity_type, e.primary_name, e.company_name, e.email, e.phone, e.status, e.confidence_score
      FROM entities e
      LEFT JOIN entity_aliases a ON e.id = a.entity_id
      WHERE 
        e.primary_name LIKE ?
        OR e.company_name LIKE ?
        OR e.email LIKE ?
        OR e.phone LIKE ?
        OR a.alias_name LIKE ?
      LIMIT ?
    `;
    return await query(sql, [like, like, like, like, like, limit]);
  }

  /**
   * Automatic cross-platform entity correlation
   * Scans contacts across WhatsApp and Gmail, correlating matching emails, phone numbers, and company names.
   */
  async autoCorrelateEntities(userId = 1) {
    const contacts = await query(`SELECT * FROM contacts WHERE user_id = ?`, [userId]);
    let resolvedCount = 0;

    for (const c of contacts) {
      if (!c.name && !c.email && !c.phone_number) continue;

      const normEmail = this.normalizeEmail(c.email);
      const normPhone = this.normalizePhone(c.phone_number);
      const primaryName = c.name || c.display_name || c.email || c.phone_number;

      // Check if entity already exists by email or phone or name
      const [existing] = await query(
        `SELECT id, email, phone, primary_name FROM entities 
         WHERE user_id = ? AND (
           (? != '' AND email = ?) 
           OR (? != '' AND phone = ?) 
           OR primary_name = ?
         ) LIMIT 1`,
        [userId, normEmail, normEmail, normPhone, normPhone, primaryName]
      );

      let entityId;
      if (existing) {
        entityId = existing.id;
        // Update missing fields
        await query(
          `UPDATE entities 
           SET email = COALESCE(email, ?), phone = COALESCE(phone, ?), updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [normEmail || null, normPhone || null, entityId]
        );
      } else {
        const ins = await query(
          `INSERT INTO entities (user_id, entity_type, primary_name, email, phone, confidence_score)
           VALUES (?, 'client', ?, ?, ?, 90.00)`,
          [userId, primaryName, normEmail || null, normPhone || null]
        );
        entityId = ins.insertId;
        resolvedCount++;
      }

      // Add alias
      if (c.name) {
        await query(
          `INSERT INTO entity_aliases (entity_id, alias_name, alias_type, source_platform, external_id)
           VALUES (?, ?, 'name', ?, ?)
           ON DUPLICATE KEY UPDATE alias_name = VALUES(alias_name)`,
          [entityId, c.name, c.source_platform, c.external_id]
        );
      }
      if (normEmail) {
        await query(
          `INSERT INTO entity_aliases (entity_id, alias_name, alias_type, source_platform, external_id)
           VALUES (?, ?, 'email', ?, ?)
           ON DUPLICATE KEY UPDATE alias_name = VALUES(alias_name)`,
          [entityId, normEmail, c.source_platform, c.external_id]
        );
      }
      if (normPhone) {
        await query(
          `INSERT INTO entity_aliases (entity_id, alias_name, alias_type, source_platform, external_id)
           VALUES (?, ?, 'phone', ?, ?)
           ON DUPLICATE KEY UPDATE alias_name = VALUES(alias_name)`,
          [entityId, normPhone, c.source_platform, c.external_id]
        );
      }
    }

    return { resolvedCount };
  }

  /**
   * Get consolidated client profile with cross-platform links
   */
  async getClientProfile(nameOrEntityId) {
    let entity = null;
    if (typeof nameOrEntityId === 'number' || /^\d+$/.test(nameOrEntityId)) {
      const [e] = await query(`SELECT * FROM entities WHERE id = ?`, [parseInt(nameOrEntityId, 10)]);
      entity = e;
    } else {
      const entities = await this.searchEntities(nameOrEntityId, 1);
      if (entities.length > 0) {
        entity = entities[0];
      }
    }

    const searchKeyword = entity ? entity.primary_name : nameOrEntityId;
    const likePattern = `%${searchKeyword}%`;

    // 1. WhatsApp records
    const waMessages = await query(`
      SELECT m.id, m.chat_jid, m.sender_name, m.timestamp, m.text_content, m.caption, m.message_type
      FROM wa_messages m
      WHERE m.sender_name LIKE ? OR m.text_content LIKE ? OR m.caption LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT 15
    `, [likePattern, likePattern, likePattern]);

    // 2. Gmail records
    const emails = await query(`
      SELECT e.id, e.message_id, e.thread_id, e.sender_name, e.sender_email, e.subject, e.snippet, e.internal_date
      FROM emails e
      WHERE e.sender_name LIKE ? OR e.sender_email LIKE ? OR e.subject LIKE ? OR e.body_plain LIKE ?
      ORDER BY e.internal_date DESC
      LIMIT 15
    `, [likePattern, likePattern, likePattern, likePattern]);

    // 3. Drive records
    const driveFiles = await query(`
      SELECT f.id, f.file_id, f.name, f.mime_type, f.size_bytes, f.web_view_link, f.drive_modified_time
      FROM drive_files f
      LEFT JOIN drive_file_contents c ON f.id = c.file_id
      WHERE f.name LIKE ? OR c.raw_text LIKE ?
      ORDER BY f.drive_modified_time DESC
      LIMIT 15
    `, [likePattern, likePattern]);

    // 4. Financial & payment references
    const paymentKeywords = ['payment', 'invoice', 'rental', 'agreement', 'amount', 'rs', 'inr', 'dollar', '$', 'quote', 'quotation', 'transfer', 'bank'];
    const financialHighlights = [];

    // Filter relevant messages/emails for financial discussions
    waMessages.forEach(m => {
      const text = `${m.text_content || ''} ${m.caption || ''}`.toLowerCase();
      if (paymentKeywords.some(kw => text.includes(kw))) {
        financialHighlights.push({
          platform: 'whatsapp',
          date: new Date(Number(m.timestamp)).toISOString(),
          context: m.text_content || m.caption,
          source: `WhatsApp (${m.sender_name || 'Chat'})`
        });
      }
    });

    emails.forEach(e => {
      const text = `${e.subject || ''} ${e.snippet || ''}`.toLowerCase();
      if (paymentKeywords.some(kw => text.includes(kw))) {
        financialHighlights.push({
          platform: 'gmail',
          date: e.internal_date ? new Date(Number(e.internal_date)).toISOString() : new Date().toISOString(),
          context: `${e.subject}: ${e.snippet}`,
          source: `Gmail (${e.sender_email})`
        });
      }
    });

    driveFiles.forEach(f => {
      const name = (f.name || '').toLowerCase();
      if (paymentKeywords.some(kw => name.includes(kw))) {
        financialHighlights.push({
          platform: 'drive',
          date: f.drive_modified_time ? new Date(f.drive_modified_time).toISOString() : new Date().toISOString(),
          context: `Document: ${f.name}`,
          source: `Google Drive (${f.name})`,
          link: f.web_view_link
        });
      }
    });

    return {
      entity: entity || {
        primary_name: searchKeyword,
        entity_type: 'client',
        status: 'inferred'
      },
      counts: {
        whatsappMessages: waMessages.length,
        emails: emails.length,
        driveFiles: driveFiles.length,
        financialItems: financialHighlights.length
      },
      whatsappMessages,
      emails,
      driveFiles,
      financialHighlights
    };
  }

  /**
   * Build chronological multi-source timeline for an entity
   */
  async getClientTimeline(nameOrEntityId) {
    const profile = await this.getClientProfile(nameOrEntityId);
    const events = [];

    profile.whatsappMessages.forEach(m => {
      events.push({
        id: `wa_${m.id}`,
        platform: 'whatsapp',
        type: 'message',
        date: new Date(Number(m.timestamp)).toISOString(),
        title: `WhatsApp message from ${m.sender_name || 'Contact'}`,
        description: m.text_content || m.caption || `[${m.message_type}]`,
        timestamp: Number(m.timestamp)
      });
    });

    profile.emails.forEach(e => {
      events.push({
        id: `gmail_${e.id}`,
        platform: 'gmail',
        type: 'email',
        date: e.internal_date ? new Date(Number(e.internal_date)).toISOString() : new Date().toISOString(),
        title: `Email: ${e.subject}`,
        description: e.snippet,
        timestamp: e.internal_date ? Number(e.internal_date) : 0
      });
    });

    profile.driveFiles.forEach(f => {
      const ts = f.drive_modified_time ? new Date(f.drive_modified_time).getTime() : 0;
      events.push({
        id: `drive_${f.id}`,
        platform: 'drive',
        type: 'document',
        date: f.drive_modified_time ? new Date(f.drive_modified_time).toISOString() : new Date().toISOString(),
        title: `Drive Document: ${f.name}`,
        description: `Modified file (${f.mime_type})`,
        link: f.web_view_link,
        timestamp: ts
      });
    });

    // Chronological order: newest to oldest
    events.sort((a, b) => b.timestamp - a.timestamp);

    return {
      entity: profile.entity,
      totalEvents: events.length,
      events
    };
  }

  /**
   * Scan for payment discussions and extracted amounts
   */
  async findPaymentReferences(queryText = '') {
    const like = `%${queryText}%`;
    const keywords = ['invoice', 'payment', 'paid', 'due', 'rental', 'agreement', 'amount', '$', 'rs', 'inr'];

    const emails = await query(`
      SELECT id, subject, snippet, sender_email, internal_date
      FROM emails
      WHERE subject LIKE '%invoice%' OR subject LIKE '%payment%' OR subject LIKE '%quote%' OR body_plain LIKE '%invoice%' OR body_plain LIKE '%payment%'
      ORDER BY internal_date DESC
      LIMIT 20
    `);

    const wa = await query(`
      SELECT id, chat_jid, sender_name, timestamp, text_content, caption
      FROM wa_messages
      WHERE text_content LIKE '%payment%' OR text_content LIKE '%paid%' OR text_content LIKE '%amount%' OR text_content LIKE '%rent%'
      ORDER BY timestamp DESC
      LIMIT 20
    `);

    const drive = await query(`
      SELECT id, name, mime_type, web_view_link, drive_modified_time
      FROM drive_files
      WHERE name LIKE '%invoice%' OR name LIKE '%agreement%' OR name LIKE '%receipt%' OR name LIKE '%quotation%'
      ORDER BY drive_modified_time DESC
      LIMIT 20
    `);

    return {
      emails: emails.map(e => ({
        id: e.id,
        platform: 'gmail',
        subject: e.subject,
        snippet: e.snippet,
        sender: e.sender_email,
        date: e.internal_date ? new Date(Number(e.internal_date)).toISOString() : null
      })),
      whatsapp: wa.map(w => ({
        id: w.id,
        platform: 'whatsapp',
        text: w.text_content || w.caption,
        sender: w.sender_name,
        date: new Date(Number(w.timestamp)).toISOString()
      })),
      drive: drive.map(d => ({
        id: d.id,
        platform: 'drive',
        name: d.name,
        mimeType: d.mime_type,
        link: d.web_view_link,
        date: d.drive_modified_time ? new Date(d.drive_modified_time).toISOString() : null
      }))
    };
  }

  /**
   * Scan for pending commitments and promises
   */
  async findPendingCommitments(queryText = '') {
    const commitments = [];
    const commitmentKeywords = ['will send', 'promise', 'by tomorrow', 'by monday', 'pending', 'deliverable', 'deadline', 'action item'];

    const wa = await query(`
      SELECT id, sender_name, timestamp, text_content
      FROM wa_messages
      WHERE text_content LIKE '%tomorrow%' OR text_content LIKE '%will send%' OR text_content LIKE '%pending%' OR text_content LIKE '%by %'
      ORDER BY timestamp DESC
      LIMIT 15
    `);

    const emails = await query(`
      SELECT id, subject, snippet, sender_email, internal_date
      FROM emails
      WHERE subject LIKE '%pending%' OR snippet LIKE '%will provide%' OR snippet LIKE '%by tomorrow%' OR snippet LIKE '%deadline%'
      ORDER BY internal_date DESC
      LIMIT 15
    `);

    wa.forEach(m => {
      commitments.push({
        platform: 'whatsapp',
        id: m.id,
        statement: m.text_content,
        participant: m.sender_name || 'WhatsApp Contact',
        date: new Date(Number(m.timestamp)).toISOString(),
        confidence: 'Discussed statement (unconfirmed)'
      });
    });

    emails.forEach(e => {
      commitments.push({
        platform: 'gmail',
        id: e.id,
        statement: `${e.subject} - ${e.snippet}`,
        participant: e.sender_email,
        date: e.internal_date ? new Date(Number(e.internal_date)).toISOString() : null,
        confidence: 'Email commitment'
      });
    });

    return commitments;
  }
}

export const entityResolver = new EntityResolver();
export default entityResolver;
