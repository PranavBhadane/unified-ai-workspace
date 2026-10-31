/**
 * WhatsApp API Verification & Testing Runner
 * Tests all 12 specified endpoints against the configured WhatsApp API Service.
 */

const BASE_URL = (process.env.WHATSAPP_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const API_KEY = process.env.WHATSAPP_API_KEY || 'wa_secure_test_key_2026';

const endpoints = [
  { id: 1, name: 'Root Endpoint', method: 'GET', path: '/' },
  { id: 2, name: 'Service Health', method: 'GET', path: '/api/health' },
  { id: 3, name: 'Connection Status', method: 'GET', path: '/api/status' },
  { id: 4, name: 'Archive Statistics', method: 'GET', path: '/api/stats' },
  { id: 5, name: 'Chats Listing', method: 'GET', path: '/api/chats' },
  { id: 6, name: 'Messages Archive', method: 'GET', path: '/api/messages' },
  { id: 7, name: 'Contacts Lookup', method: 'GET', path: '/api/contacts' },
  { id: 8, name: 'Groups Directory', method: 'GET', path: '/api/groups' },
  { id: 9, name: 'Global Search', method: 'GET', path: '/api/search/all?q=test&scope=all' },
  { id: 10, name: 'Group Sync', method: 'POST', path: '/api/sync/groups' },
  { id: 11, name: 'Daily Analytics', method: 'GET', path: '/api/analytics/daily?tzOffset=330' },
  { id: 12, name: 'Connector Search', method: 'GET', path: '/api/connector/search?query=test&scope=all&limit=10' }
];

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`   WHATSAPP API SERVICE VERIFICATION RUNNER`);
  console.log(`   Target Base URL: ${BASE_URL}`);
  console.log(`   Timestamp:       ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  const results = [];
  let passedCount = 0;

  for (const ep of endpoints) {
    const url = `${BASE_URL}${ep.path}`;
    const t0 = Date.now();
    try {
      const headers = {
        'Accept': 'application/json',
        'X-Request-Id': `test-${ep.id}-${Date.now()}`
      };
      if (API_KEY) {
        headers['x-api-key'] = API_KEY;
        headers['Authorization'] = `Bearer ${API_KEY}`;
      }

      const res = await fetch(url, {
        method: ep.method,
        headers,
        signal: AbortSignal.timeout(6000)
      });
      const durationMs = Date.now() - t0;
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = { text: 'non-json response' };
      }

      const passed = res.ok;
      if (passed) passedCount++;

      const summary = {
        id: ep.id,
        name: ep.name,
        endpoint: `${ep.method} ${ep.path}`,
        status: res.status,
        durationMs,
        passed,
        preview: JSON.stringify(body).substring(0, 120) + (JSON.stringify(body).length > 120 ? '...' : '')
      };
      results.push(summary);

      const symbol = passed ? '?? PASS' : '? FAIL';
      console.log(`[${ep.id.toString().padStart(2, '0')}/12] ${symbol} | HTTP ${res.status} (${durationMs}ms) | ${ep.method} ${ep.path}`);
      console.log(`     Summary: ${summary.preview}\n`);
    } catch (err) {
      const durationMs = Date.now() - t0;
      results.push({
        id: ep.id,
        name: ep.name,
        endpoint: `${ep.method} ${ep.path}`,
        status: 'CONN_ERR',
        durationMs,
        passed: false,
        preview: err.message
      });
      console.log(`[${ep.id.toString().padStart(2, '0')}/12] ? FAIL | CONN_ERR (${durationMs}ms) | ${ep.method} ${ep.path}`);
      console.log(`     Error: ${err.message}\n`);
    }
  }

  console.log(`======================================================`);
  console.log(`TEST RUN SUMMARY: ${passedCount}/${endpoints.length} endpoints passed.`);
  console.log(`======================================================\n`);

  return { results, passedCount, total: endpoints.length };
}

runTests().then((report) => {
  if (process.send) process.send(report);
}).catch((e) => {
  console.error('Fatal test error:', e);
});
