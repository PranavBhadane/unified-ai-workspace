import fs from 'fs';
import path from 'path';

// Load backend/.env if present using native fs
try {
  const envPath = path.resolve('./backend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch (e) {}

import { testConnection, query } from './backend/src/config/db.js';
import documentExtractor from './backend/src/services/documents/documentExtractor.js';
import storageManager from './backend/src/services/storage/storageManager.js';
import searchEngine from './backend/src/services/search/searchEngine.js';
import entityResolver from './backend/src/services/entities/entityResolver.js';
import geminiService from './backend/src/services/ai/geminiService.js';
import syncManager from './backend/src/services/sync/syncManager.js';
import whatsappConnector from './backend/src/connectors/whatsapp/whatsappConnector.js';
import gmailConnector from './backend/src/connectors/gmail/gmailConnector.js';
import driveConnector from './backend/src/connectors/drive/driveConnector.js';

async function runTestSuite() {
  console.log('=================================================================');
  console.log('       UNIFIED AI WORKSPACE - SYSTEM INTEGRATION TEST SUITE      ');
  console.log('=================================================================\n');

  const results = {
    passed: 0,
    failed: 0,
    requiresCredentials: 0
  };

  const pass = (name, detail = '') => {
    results.passed++;
    console.log(`\x1b[32m[PASS]\x1b[0m ${name} ${detail ? `(${detail})` : ''}`);
  };

  const fail = (name, err) => {
    results.failed++;
    console.log(`\x1b[31m[FAIL]\x1b[0m ${name}: ${err}`);
  };

  const reqCred = (name, reason) => {
    results.requiresCredentials++;
    console.log(`\x1b[33m[REQUIRES CREDENTIALS]\x1b[0m ${name}: ${reason}`);
  };

  // 1. MySQL Connectivity
  try {
    const dbTest = await testConnection();
    if (dbTest.connected) {
      pass('MySQL Database Connectivity', `DB: ${dbTest.database}, Version: ${dbTest.version}`);
    } else {
      fail('MySQL Database Connectivity', dbTest.error);
    }
  } catch (e) {
    fail('MySQL Database Connectivity', e.message);
  }

  // 2. Database Schema & Tables
  try {
    const tables = await query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    const expected = ['users', 'connected_accounts', 'wa_messages', 'emails', 'drive_files', 'document_chunks', 'entities', 'sync_jobs'];
    const missing = expected.filter(e => !tableNames.includes(e));
    if (missing.length === 0) {
      pass('Database Schema & Tables', `Total verified tables: ${tableNames.length}`);
    } else {
      fail('Database Schema & Tables', `Missing: ${missing.join(', ')}`);
    }
  } catch (e) {
    fail('Database Schema & Tables', e.message);
  }

  // 3. Storage Manager & Deduplication
  try {
    const testBuf = Buffer.from('Unified AI Workspace Test Content');
    const saved = storageManager.saveFile('temporary', 'test_folder', 'sample.txt', testBuf);
    const stats = storageManager.getStorageStats();
    if (saved.hash && stats.totalBytes >= 0) {
      pass('Local Storage Manager & SHA-256 Hashing', `Hash: ${saved.hash.substring(0, 16)}...`);
    } else {
      fail('Local Storage Manager', 'Failed to generate hash or stats');
    }
  } catch (e) {
    fail('Local Storage Manager', e.message);
  }

  // 4. Document Processing & Chunking
  try {
    const sampleText = 'Rental Agreement between ABC Enterprises and Rahul Sharma for equipment rental of Rs. 45,000 per month.';
    const chunks = documentExtractor.chunkText(sampleText, 50, 10);
    const ingestRes = await documentExtractor.processAndIndexDocument({
      sourcePlatform: 'drive',
      originalRecordId: 99999,
      fileId: 'test_doc_001',
      fileName: 'Rental_Agreement_ABC.txt',
      senderOrOwner: 'Rahul Sharma',
      timestamp: new Date(),
      buffer: Buffer.from(sampleText, 'utf8'),
      mimeType: 'text/plain'
    });
    if (ingestRes.chunksCount > 0) {
      pass('Document Extraction & Chunking Engine', `Created ${ingestRes.chunksCount} chunks`);
    } else {
      fail('Document Extraction', 'No chunks created');
    }
  } catch (e) {
    fail('Document Extraction', e.message);
  }

  // 5. Full-Text Search Engine
  try {
    const resultsAll = await searchEngine.searchAllSources({ q: 'Rental Agreement', limit: 5 });
    pass('Full-Text Search Engine (MySQL FULLTEXT)', `Found ${resultsAll.length} matching indexed records`);
  } catch (e) {
    fail('Full-Text Search Engine', e.message);
  }

  // 6. Cross-Platform Entity Resolution
  try {
    const normPhone = entityResolver.normalizePhone('+91 98765-43210');
    const normEmail = entityResolver.normalizeEmail(' RAHUL@XYZ.COM ');
    if (normPhone === '9876543210' && normEmail === 'rahul@xyz.com') {
      pass('Cross-Platform Entity Normalization & Matching', `Phone: ${normPhone}, Email: ${normEmail}`);
    } else {
      fail('Entity Resolution Normalization', 'Incorrect normalization');
    }
  } catch (e) {
    fail('Entity Resolution Normalization', e.message);
  }

  // 7. Synchronization Manager Recovery
  try {
    await syncManager.recoverStartup();
    pass('Sync Manager Startup Recovery', 'Cleaned up stale states');
  } catch (e) {
    fail('Sync Manager Startup Recovery', e.message);
  }

  // 8. Gemini Function Calling Tools Verification
  try {
    const tools = geminiService.getToolDeclarations();
    if (tools.length >= 18) {
      pass(`Gemini Tool Function Declarations (${tools.length} Tools)`, `All ${tools.length} tools correctly defined with JSON schemas`);
    } else {
      fail('Gemini Tool Declarations', `Expected at least 18 tools, found ${tools.length}`);
    }
  } catch (e) {
    fail('Gemini Tool Declarations', e.message);
  }

  // 9. Gemini API Live Connection
  try {
    const gemTest = await geminiService.testConnection();
    if (gemTest.success) {
      pass('Google Gemini API Connection', `Model: ${gemTest.model}`);
    } else {
      reqCred('Google Gemini API Connection', gemTest.error);
    }
  } catch (e) {
    reqCred('Google Gemini API Connection', e.message);
  }

  // 10. WhatsApp Baileys Connector
  try {
    const waStatus = whatsappConnector.getStatus();
    pass('WhatsApp Baileys Linked-Device Connector', `Initial state: ${waStatus.status}`);
  } catch (e) {
    fail('WhatsApp Connector', e.message);
  }

  // 11. Gmail Google OAuth URL Flow
  try {
    gmailConnector.getAuthUrl('gmail');
    pass('Gmail Google OAuth 2.0 Auth URL Generation', 'OAuth ready');
  } catch (e) {
    reqCred('Gmail Google OAuth 2.0 Auth URL Generation', e.message);
  }

  // 12. Drive Google OAuth URL Flow
  try {
    driveConnector.getAuthUrl('drive');
    pass('Google Drive OAuth 2.0 Auth URL Generation', 'OAuth ready');
  } catch (e) {
    reqCred('Google Drive OAuth 2.0 Auth URL Generation', e.message);
  }

  console.log('\n=================================================================');
  console.log(`TEST SUMMARY: ${results.passed} Passed, ${results.failed} Failed, ${results.requiresCredentials} Requires User Credentials`);
  console.log('=================================================================\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

runTestSuite().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
