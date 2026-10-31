import { query, testConnection } from '../config/db.js';

/**
 * Optional Demo Data Seeder
 * Populates clean, sample mock data across WhatsApp, Gmail, and Google Drive
 * for developers to explore the application without connecting real accounts.
 * Run explicitly via: npm run seed:demo
 */
async function seedDemo() {
  console.log('[SeedDemo] Checking database connectivity...');
  const test = await testConnection();
  if (!test.connected) {
    console.error('[SeedDemo] Database not connected:', test.error);
    process.exit(1);
  }

  try {
    console.log('[SeedDemo] Inserting sample demo contacts...');
    const demoContacts = [
      { name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98200 11111', org: 'Alpha Rentals' },
      { name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+91 98200 22222', org: 'Apex Innovations' },
      { name: 'David Miller', email: 'david.miller@example.com', phone: '+1 415 555 0192', org: 'CloudWorks Inc' }
    ];

    for (const c of demoContacts) {
      await query(
        `INSERT INTO contacts (user_id, source_platform, name, display_name, phone_number, email)
         VALUES (1, 'demo', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [c.name, c.name, c.phone, c.email]
      );
    }

    console.log('[SeedDemo] Inserting sample demo WhatsApp chats and messages...');
    await query(
      `INSERT INTO wa_chats (connected_account_id, jid, name, is_group, unread_count)
       VALUES (1, '919820011111@s.whatsapp.net', 'Rahul Sharma', 0, 0)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );

    const now = Date.now();
    const demoMessages = [
      { sender: 'Rahul Sharma', body: 'Hi, sending you the revised quotation for the heavy machinery rental: INR 45,000 per month.', time: now - 3600000 * 24, fromMe: 0 },
      { sender: 'Me', body: 'Received, thank you Rahul. Could you confirm if delivery is included in this quote?', time: now - 3600000 * 22, fromMe: 1 },
      { sender: 'Rahul Sharma', body: 'Yes, delivery and initial installation are included. Payment terms: 50% advance upon contract signing.', time: now - 3600000 * 20, fromMe: 0 }
    ];

    for (const m of demoMessages) {
      await query(
        `INSERT INTO wa_messages (connected_account_id, chat_jid, message_id, sender_name, timestamp, message_type, text_content, is_from_me)
         VALUES (1, '919820011111@s.whatsapp.net', ?, ?, ?, 'conversation', ?, ?)
         ON DUPLICATE KEY UPDATE text_content = VALUES(text_content)`,
        [`demo-wa-${Math.random().toString(36).substring(7)}`, m.sender, m.time, m.body, m.fromMe]
      );
    }

    console.log('[SeedDemo] Inserting sample demo Gmail correspondence...');
    const demoEmails = [
      {
        msgId: 'demo-gmail-1',
        senderName: 'David Miller',
        senderEmail: 'david.miller@example.com',
        subject: 'Master Services Agreement & Statement of Work #2026',
        snippet: 'Attached please find the finalized MSA for our upcoming infrastructure migration project.',
        body: 'Hi team,\n\nAttached is the Master Services Agreement for our Q3/Q4 deliverables.\n\nTotal estimated project cost: $18,500.\nTarget completion date: December 15, 2026.\n\nPlease review and let us know if any terms need adjustments.\n\nBest regards,\nDavid Miller',
        date: now - 3600000 * 48
      },
      {
        msgId: 'demo-gmail-2',
        senderName: 'Priya Patel',
        senderEmail: 'priya.patel@example.com',
        subject: 'Invoice #INV-8891 - Apex Innovations Monthly Retainer',
        snippet: 'Please find attached invoice #INV-8891 for consulting services rendered in October 2026.',
        body: 'Dear Partner,\n\nInvoice #INV-8891 in the amount of INR 75,000 is due for payment on November 10, 2026.\n\nBank transfer details are listed on the invoice PDF.\n\nRegards,\nPriya Patel',
        date: now - 3600000 * 12
      }
    ];

    for (const e of demoEmails) {
      await query(
        `INSERT INTO emails (connected_account_id, thread_id, message_id, sender_name, sender_email, subject, snippet, body_plain, internal_date)
         VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE subject = VALUES(subject)`,
        [`thread-${e.msgId}`, e.msgId, e.senderName, e.senderEmail, e.subject, e.snippet, e.body, e.date]
      );
    }

    console.log('[SeedDemo] Optional demo seed records inserted successfully!');
    console.log('[SeedDemo] You can now test AI Assistant search, queries, reports, and dashboards with demo data.');
    process.exit(0);
  } catch (err) {
    console.error('[SeedDemo] Error seeding demo data:', err);
    process.exit(1);
  }
}

seedDemo();
