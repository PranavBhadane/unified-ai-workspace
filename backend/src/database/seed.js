import bcrypt from 'bcryptjs';
import { query, testConnection } from '../config/db.js';

async function seed() {
  console.log('[Seed] Checking connection...');
  const test = await testConnection();
  if (!test.connected) {
    console.error('[Seed] Database not connected:', test.error);
    process.exit(1);
  }

  try {
    // 1. Seed primary user if not exists
    const users = await query('SELECT id FROM users WHERE username = ?', ['admin']);
    let userId;
    if (users.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      const res = await query(
        `INSERT INTO users (username, email, password_hash, full_name, role)
         VALUES (?, ?, ?, ?, ?)`,
        ['admin', 'admin@workspace.local', passwordHash, 'Workspace Owner', 'admin']
      );
      userId = res.insertId;
      console.log(`[Seed] Created default user: admin (ID: ${userId})`);
    } else {
      userId = users[0].id;
      console.log(`[Seed] User admin already exists (ID: ${userId})`);
    }

    // 2. Seed default app_settings
    const defaultSettings = [
      { key: 'gemini_model', value: 'gemini-3-flash-preview', desc: 'Active Gemini LLM model identifier' },
      { key: 'default_ai_provider', value: 'gemini', desc: 'Active default AI provider (gemini, openai, anthropic)' },
      { key: 'sync_interval_mins', value: '60', desc: 'Automated polling interval in minutes' },
      { key: 'auto_sync_enabled', value: 'false', desc: 'Enable automatic background polling' },
      { key: 'ai_allowed_sources', value: JSON.stringify(['whatsapp', 'gmail', 'drive']), desc: 'Connected sources Gemini is authorized to search' },
      { key: 'ocr_enabled', value: 'true', desc: 'Enable OCR processing for image and scanned PDF attachments' },
      { key: 'storage_path', value: 'storage', desc: 'Local attachments repository root' }
    ];

    for (const s of defaultSettings) {
      await query(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [s.key, s.value, s.desc]
      );
    }
    console.log('[Seed] Seeded default app settings.');

    console.log('[Seed] Database seeding finished successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Seeding error:', error);
    process.exit(1);
  }
}

seed();
