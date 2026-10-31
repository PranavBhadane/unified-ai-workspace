import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import * as docx from 'docx';
import * as XLSX from 'xlsx';
import { query } from '../../config/db.js';
import config from '../../config/env.js';
import logger from '../../utils/logger.js';
import aiManager from '../ai/aiManager.js';

class ReportGenerator {
  constructor() {
    this.reportsDir = path.resolve(config.storage.rootPath, 'reports');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Gather multi-platform evidence for a report
   */
  async gatherEvidence({ contactId, entityId, topic = '', dateRange = 'all' }) {
    const evidence = {
      contact: null,
      entity: null,
      messages: [],
      emails: [],
      files: [],
      commitments: []
    };

    // 1. Contact info
    if (contactId) {
      const [c] = await query('SELECT * FROM contacts WHERE id = ?', [contactId]);
      evidence.contact = c || null;
    } else if (topic) {
      const [c] = await query('SELECT * FROM contacts WHERE display_name LIKE ? OR email LIKE ? LIMIT 1', [`%${topic}%`, `%${topic}%`]);
      evidence.contact = c || null;
    }

    // 2. WhatsApp messages
    try {
      let waSql = `
        SELECT wm.id, wm.chat_jid, wm.sender_name, wm.text_content, wm.caption, wm.timestamp, wm.is_from_me, wc.name as chat_name
        FROM wa_messages wm
        LEFT JOIN wa_chats wc ON wm.chat_jid = wc.jid
        WHERE 1=1
      `;
      const waParams = [];

      if (evidence.contact) {
        waSql += ` AND (wm.sender_name LIKE ? OR wm.sender_jid LIKE ? OR wc.name LIKE ?)`;
        const qStr = `%${evidence.contact.display_name}%`;
        const pStr = evidence.contact.phone_number ? `%${evidence.contact.phone_number}%` : qStr;
        waParams.push(qStr, pStr, qStr);
      } else if (topic) {
        waSql += ` AND (wm.text_content LIKE ? OR wm.caption LIKE ? OR wm.sender_name LIKE ?)`;
        waParams.push(`%${topic}%`, `%${topic}%`, `%${topic}%`);
      }

      waSql += ` ORDER BY wm.timestamp DESC LIMIT 40`;
      evidence.messages = await query(waSql, waParams);
    } catch (err) {
      logger.warn('reports', `Error gathering WhatsApp records: ${err.message}`);
    }

    // 3. Gmail emails
    try {
      let emailSql = `
        SELECT id, message_id, thread_id, sender_name, sender_email, subject, snippet, body_plain, internal_date
        FROM emails
        WHERE 1=1
      `;
      const emailParams = [];

      if (evidence.contact) {
        emailSql += ` AND (sender_email LIKE ? OR sender_name LIKE ? OR recipient_to LIKE ?)`;
        const eStr = evidence.contact.email ? `%${evidence.contact.email}%` : `%${evidence.contact.display_name}%`;
        emailParams.push(eStr, `%${evidence.contact.display_name}%`, eStr);
      } else if (topic) {
        emailSql += ` AND (subject LIKE ? OR snippet LIKE ? OR body_plain LIKE ?)`;
        emailParams.push(`%${topic}%`, `%${topic}%`, `%${topic}%`);
      }

      emailSql += ` ORDER BY internal_date DESC LIMIT 30`;
      evidence.emails = await query(emailSql, emailParams);
    } catch (err) {
      logger.warn('reports', `Error gathering Gmail records: ${err.message}`);
    }

    // 4. Drive files
    try {
      let driveSql = `
        SELECT id, name, mime_type, size_bytes, web_view_link, drive_modified_time
        FROM drive_files
        WHERE is_trashed = false
      `;
      const driveParams = [];

      if (evidence.contact) {
        driveSql += ` AND (name LIKE ? OR owners_json LIKE ?)`;
        driveParams.push(`%${evidence.contact.display_name}%`, `%${evidence.contact.display_name}%`);
      } else if (topic) {
        driveSql += ` AND name LIKE ?`;
        driveParams.push(`%${topic}%`);
      }

      driveSql += ` ORDER BY drive_modified_time DESC LIMIT 20`;
      evidence.files = await query(driveSql, driveParams);
    } catch (err) {
      logger.warn('reports', `Error gathering Drive files: ${err.message}`);
    }

    return evidence;
  }

  /**
   * Template prompt definitions
   */
  getTemplateInstructions(templateType, targetName) {
    const templates = {
      contact_profile: `Create an exhaustive Contact Profile Dossier for "${targetName}".
Cover:
1. Executive Summary & Identity (phone, email, channels active)
2. Complete Interaction Timeline across WhatsApp and Gmail
3. Key Business Topics Discussed & Relationship Context
4. Verified Facts vs Stated Preferences
5. Recommended Follow-ups and Action Items`,

      client_relationship: `Create a Comprehensive Client Relationship Analysis for "${targetName}".
Cover:
1. Client Overview & Account Status
2. Historical Communication Patterns (response frequency, platform split)
3. Ongoing Projects, Quotes, and Deals
4. Commitments Made (by us and by the client)
5. Health Assessment & Strategic Recommendations`,

      communication_history: `Generate a Multi-Channel Communication Audit for "${targetName}".
Cover:
1. Interaction Volume & Channel Breakdown (WhatsApp vs Gmail)
2. Chronological Log of Major Conversations with Date & Time citations
3. Sentiment & Tone Assessment
4. Unresolved Inquiries or Pending Questions`,

      business_activity: `Produce a Business & Operational Activity Log regarding "${targetName}".
Cover:
1. Operational Deliverables & Milestones Discussed
2. Quotations, Pricing or Agreements Exchanged
3. Document Exchange History (Files, Spreadsheets, PDFs)
4. Active Decisions Pending`,

      payment_transaction: `Produce a Financial, Rental & Payment Reference Report for "${targetName}".
Cover:
1. All Financial Discussions, Invoices, Fees, or Rent Amounts Mentioned
2. Verified Transactions vs Unconfirmed Promises
3. Payment Dates, Accounts, and Due Amounts
4. Outstanding or Disputed Balances`,

      pending_commitments: `Create an Actionable Pending Commitments & Action Items Report for "${targetName}".
Cover:
1. Explicit Promises & Commitments Made by User to Contact
2. Explicit Commitments Made by Contact to User
3. Due Dates, Deadlines & Current Status
4. Urgency Ranking (Critical, High, Medium, Low)`,

      document_summary: `Generate a Cross-Channel Document & Contract Summary for "${targetName}".
Cover:
1. Inventory of all Drive Files, Email Attachments, and WhatsApp Media
2. Content Synthesis of Key Agreements, Spreadsheets, or Resumes
3. Version Tracking and Missing Documents
4. Document Access Links & Verification`,

      meeting_discussion: `Produce a Meeting, Call & Discussion Digest for "${targetName}".
Cover:
1. Record of Calls, Meetings, and Significant Message Exchanges
2. Key Discussion Points & Arguments
3. Decisions Agreed Upon
4. Action Items with Assigned Responsibility`,

      custom_ai_report: `Generate a Tailored In-Depth AI Intelligence Report based on the user's specific guidance.`
    };

    return templates[templateType] || templates.custom_ai_report;
  }

  /**
   * Generate report content using AI synthesis
   */
  async generateReportContent({
    templateType,
    contactId,
    entityId,
    topic,
    customPrompt,
    provider = 'gemini',
    model = null
  }) {
    // 1. Gather all raw evidence
    const evidence = await this.gatherEvidence({ contactId, entityId, topic });
    const targetName = evidence.contact?.display_name || topic || 'General Workspace Subject';

    // 2. Prepare structured evidence text
    const evidenceTextParts = [];

    if (evidence.contact) {
      evidenceTextParts.push(`CONTACT RECORD:
Name: ${evidence.contact.display_name}
Phone: ${evidence.contact.phone_number || 'N/A'}
Email: ${evidence.contact.email || 'N/A'}`);
    }

    if (evidence.messages.length > 0) {
      evidenceTextParts.push(`WHATSAPP RECORDS (${evidence.messages.length} messages):
` + evidence.messages.map(m => {
        const timeStr = m.timestamp ? new Date(Number(m.timestamp)).toISOString() : 'N/A';
        const bodyStr = m.text_content || m.caption || '[Media Message]';
        return `[WA #${m.id} - ${timeStr}] ${m.is_from_me ? 'Me' : m.sender_name || 'Contact'}: ${bodyStr}`;
      }).join('\n'));
    }

    if (evidence.emails.length > 0) {
      evidenceTextParts.push(`GMAIL RECORDS (${evidence.emails.length} emails):
` + evidence.emails.map(e => {
        const timeStr = e.internal_date ? new Date(Number(e.internal_date)).toISOString() : 'N/A';
        return `[Gmail #${e.id} - ${timeStr}] From: ${e.sender_name || 'Unknown'} <${e.sender_email || ''}> | Subject: "${e.subject || '(No Subject)'}"\nSnippet: ${e.snippet || ''}`;
      }).join('\n\n'));
    }

    if (evidence.files.length > 0) {
      evidenceTextParts.push(`GOOGLE DRIVE RECORDS (${evidence.files.length} files):
` + evidence.files.map(f => `[Drive #${f.id} - Modified: ${new Date(f.drive_modified_time).toISOString()}] Name: "${f.name}" (${(f.size_bytes/1024).toFixed(1)} KB)`).join('\n'));
    }

    const compiledEvidence = evidenceTextParts.length > 0
      ? evidenceTextParts.join('\n\n====================\n\n')
      : 'No explicit records found in local database for the requested query criteria.';

    const systemPrompt = `You are a Senior Business Intelligence and Auditing Specialist for Unified AI Workspace.
Your task is to synthesize the provided multi-channel workspace data into a highly structured, professional, executive-grade intelligence report.

STRICT ACCURACY RULES:
1. Always cite exact record IDs when stating facts (e.g., [WA #12], [Gmail #4], [Drive #2]).
2. Classify evidence into three clear categories:
   - "Verified Facts": Unambiguous records directly documented in the data with specific dates and IDs.
   - "Contact Statements": Claims or messages communicated by the party.
   - "AI Interpretations / Recommendations": Inferences, risk assessments, and action plans.
3. If no records exist for a section, state "No recorded data found in synchronized sources" rather than inventing information.
4. Format output in clean, professional Markdown with clear H1, H2, H3 headers, bullet points, and data tables.`;

    const templatePrompt = this.getTemplateInstructions(templateType, targetName);
    const userPrompt = `${templatePrompt}

${customPrompt ? `ADDITIONAL USER INSTRUCTIONS:
${customPrompt}` : ''}

SYNCHRONIZED WORKSPACE EVIDENCE:
${compiledEvidence}

Generate the complete comprehensive report in Markdown.`;

    logger.info('reports', `Synthesizing report using ${provider} (${model || 'default'}) for ${targetName}`);

    const aiResponse = await aiManager.chat({
      provider,
      model,
      message: userPrompt,
      systemPrompt,
      temperature: 0.2
    });

    const reportMarkdown = aiResponse.content || '# Intelligence Report\n\nReport generation completed without text output.';

    // Extract title from markdown or use template
    const titleMatch = reportMarkdown.match(/^#\s+(.+)$/m);
    const reportTitle = titleMatch ? titleMatch[1].trim() : `${this.getTemplateName(templateType)} - ${targetName}`;

    // Extract summary
    const summaryMatch = reportMarkdown.match(/(?:Executive Summary|Overview)[\s\S]*?\n\n([^\n#]+)/i);
    const reportSummary = summaryMatch ? summaryMatch[1].trim().slice(0, 300) : `Intelligence dossier generated for ${targetName}`;

    return {
      title: reportTitle,
      summary: reportSummary,
      markdown: reportMarkdown,
      targetName,
      templateType,
      evidence
    };
  }

  getTemplateName(type) {
    const names = {
      contact_profile: 'Contact Profile Dossier',
      client_relationship: 'Client Relationship Analysis',
      communication_history: 'Communication History Audit',
      business_activity: 'Business Activity Log',
      payment_transaction: 'Financial & Payment Reference',
      pending_commitments: 'Pending Commitments Report',
      document_summary: 'Document & Contract Summary',
      meeting_discussion: 'Meeting & Discussion Digest',
      custom_ai_report: 'Custom AI Intelligence Report'
    };
    return names[type] || 'Workspace Intelligence Report';
  }

  /**
   * Export to clean PDF using PDFKit
   */
  async exportToPDF(reportData, filename) {
    const fullPath = path.join(this.reportsDir, filename);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      // Header Banner
      doc.rect(50, 50, 495, 4).fill('#4f46e5');
      doc.moveDown(1);

      // Title
      doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text(reportData.title, { align: 'left' });
      doc.moveDown(0.3);

      // Metadata line
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Generated: ${new Date().toLocaleString()} | Unified AI Workspace Intelligence Engine | Scope: ${reportData.targetName}`);
      doc.moveDown(1);

      // Render Markdown sections cleanly
      const lines = reportData.markdown.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          doc.moveDown(0.4);
          continue;
        }

        if (trimmed.startsWith('# ')) {
          // Main title already printed, skip or treat as H1
          continue;
        } else if (trimmed.startsWith('## ')) {
          doc.moveDown(0.8);
          doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(trimmed.replace(/^##\s+/, ''));
          doc.moveDown(0.3);
        } else if (trimmed.startsWith('### ')) {
          doc.moveDown(0.5);
          doc.fillColor('#334155').fontSize(11).font('Helvetica-Bold').text(trimmed.replace(/^###\s+/, ''));
          doc.moveDown(0.2);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.replace(/^[-*]\s+/, '');
          doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(`•  ${bulletText}`, {
            indent: 10,
            lineGap: 3
          });
        } else if (trimmed.startsWith('> ')) {
          doc.rect(50, doc.y, 3, 20).fill('#6366f1');
          doc.fillColor('#475569').fontSize(9).font('Helvetica-Oblique').text(trimmed.replace(/^>\s+/, ''), 60, doc.y - 18, {
            lineGap: 2
          });
          doc.moveDown(0.3);
        } else {
          doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(trimmed, {
            lineGap: 3,
            align: 'justify'
          });
        }
      }

      // Footer
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#94a3b8').text(`Page ${i + 1} of ${pages.count} — Confidential Unified AI Dossier`, 50, 780, {
          align: 'center',
          width: 495
        });
      }

      doc.end();
      stream.on('finish', () => resolve({ fullPath, sizeBytes: fs.statSync(fullPath).size }));
      stream.on('error', reject);
    });
  }

  /**
   * Export to DOCX using docx library
   */
  async exportToDOCX(reportData, filename) {
    const fullPath = path.join(this.reportsDir, filename);

    const docChildren = [
      new docx.Paragraph({
        text: reportData.title,
        heading: docx.HeadingLevel.TITLE,
        spacing: { after: 120 }
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: `Generated: ${new Date().toLocaleString()} | Target: ${reportData.targetName}`,
            italics: true,
            color: '64748b',
            size: 18
          })
        ],
        spacing: { after: 300 }
      })
    ];

    const lines = reportData.markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('# ')) continue;

      if (trimmed.startsWith('## ')) {
        docChildren.push(
          new docx.Paragraph({
            text: trimmed.replace(/^##\s+/, ''),
            heading: docx.HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 }
          })
        );
      } else if (trimmed.startsWith('### ')) {
        docChildren.push(
          new docx.Paragraph({
            text: trimmed.replace(/^###\s+/, ''),
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 }
          })
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        docChildren.push(
          new docx.Paragraph({
            text: trimmed.replace(/^[-*]\s+/, ''),
            bullet: { level: 0 },
            spacing: { after: 60 }
          })
        );
      } else {
        docChildren.push(
          new docx.Paragraph({
            text: trimmed,
            spacing: { after: 120 }
          })
        );
      }
    }

    const doc = new docx.Document({
      sections: [{ properties: {}, children: docChildren }]
    });

    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
    return { fullPath, sizeBytes: buffer.length };
  }

  /**
   * Export to XLSX using SheetJS
   */
  async exportToXLSX(reportData, filename) {
    const fullPath = path.join(this.reportsDir, filename);
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Overview
    const overviewData = [
      ['Report Title', reportData.title],
      ['Generated On', new Date().toISOString()],
      ['Target Subject', reportData.targetName],
      ['Template Type', reportData.templateType],
      ['Summary', reportData.summary],
      [],
      ['Full Markdown Content'],
      [reportData.markdown]
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, wsOverview, 'Overview');

    // Sheet 2: WhatsApp Messages Evidence
    if (reportData.evidence?.messages?.length > 0) {
      const waRows = [
        ['Message ID', 'Timestamp', 'Sender Name', 'From Me', 'Chat Name', 'Content'],
        ...reportData.evidence.messages.map(m => [
          m.id,
          m.timestamp ? new Date(Number(m.timestamp)).toISOString() : '',
          m.sender_name || '',
          m.is_from_me ? 'Yes' : 'No',
          m.chat_name || '',
          m.text_content || m.caption || '[Media]'
        ])
      ];
      const wsWa = XLSX.utils.aoa_to_sheet(waRows);
      XLSX.utils.book_append_sheet(workbook, wsWa, 'WhatsApp Evidence');
    }

    // Sheet 3: Gmail Evidence
    if (reportData.evidence?.emails?.length > 0) {
      const emailRows = [
        ['Email ID', 'Date', 'Sender Name', 'Sender Email', 'Subject', 'Snippet'],
        ...reportData.evidence.emails.map(e => [
          e.id,
          e.internal_date ? new Date(Number(e.internal_date)).toISOString() : '',
          e.sender_name || '',
          e.sender_email || '',
          e.subject || '',
          e.snippet || ''
        ])
      ];
      const wsEmail = XLSX.utils.aoa_to_sheet(emailRows);
      XLSX.utils.book_append_sheet(workbook, wsEmail, 'Gmail Evidence');
    }

    // Sheet 4: Drive Files Evidence
    if (reportData.evidence?.files?.length > 0) {
      const fileRows = [
        ['File ID', 'Name', 'MIME Type', 'Size (Bytes)', 'Modified Time', 'Link'],
        ...reportData.evidence.files.map(f => [
          f.id,
          f.name,
          f.mime_type,
          f.size_bytes,
          f.drive_modified_time,
          f.web_view_link || ''
        ])
      ];
      const wsFiles = XLSX.utils.aoa_to_sheet(fileRows);
      XLSX.utils.book_append_sheet(workbook, wsFiles, 'Drive Files');
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    fs.writeFileSync(fullPath, buffer);
    return { fullPath, sizeBytes: buffer.length };
  }

  /**
   * Export to CSV
   */
  async exportToCSV(reportData, filename) {
    const fullPath = path.join(this.reportsDir, filename);
    const rows = [
      ['Title', `"${reportData.title.replace(/"/g, '""')}"`],
      ['Target', `"${reportData.targetName.replace(/"/g, '""')}"`],
      ['Generated', `"${new Date().toISOString()}"`],
      ['Summary', `"${reportData.summary.replace(/"/g, '""')}"`],
      ['Content', `"${reportData.markdown.replace(/"/g, '""')}"`]
    ];
    const csvContent = rows.map(r => r.join(',')).join('\n');
    fs.writeFileSync(fullPath, csvContent, 'utf8');
    return { fullPath, sizeBytes: fs.statSync(fullPath).size };
  }
}

export default new ReportGenerator();
