import express from 'express';

const app = express();
const PORT = process.env.WHATSAPP_MOCK_PORT || 3001;
const API_KEY = process.env.WHATSAPP_API_KEY || 'wa_secure_test_key_2026';

app.use(express.json());

// Optional auth verification middleware
app.use((req, res, next) => {
  const reqKey = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  // If API key is provided, verify it. If not required by caller in testing, allow or reject based on config
  if (process.env.REQUIRE_AUTH === 'true' && reqKey !== API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
  }
  next();
});

// 1. GET / - List available endpoints
app.get('/', (req, res) => {
  res.json({
    service: 'WhatsApp Archive & MCP API',
    version: '1.0.0',
    endpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/status',
      'GET /api/stats',
      'POST /api/sync/groups',
      'GET /api/chats',
      'GET /api/messages',
      'GET /api/contacts',
      'GET /api/groups',
      'GET /api/search',
      'GET /api/search/all',
      'GET /api/analytics/daily',
      'GET /api/connector/search',
      'POST /mcp'
    ]
  });
});

// 2. GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'WhatsApp API',
    healthy: true
  });
});

// 3. GET /api/status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'connected',
    account: {
      phone: process.env.WHATSAPP_PHONE || '15550192834',
      name: process.env.WHATSAPP_USER_NAME || 'Workspace User',
      platform: 'whatsapp'
    },
    syncStatus: 'idle',
    lastSyncTime: new Date().toISOString()
  });
});

// 4. GET /api/stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalChats: 48,
    totalMessages: 1824,
    totalGroups: 14,
    totalMedia: 216,
    totalLinks: 87,
    totalParticipants: 165,
    storageUsageBytes: 48920112,
    lastArchiveUpdate: new Date().toISOString()
  });
});

// 5. GET /api/chats
app.get('/api/chats', (req, res) => {
  const { type, q, limit = 50 } = req.query;
  const mockChats = [
    { id: '919822000001@s.whatsapp.net', name: 'Rahul Sharma', type: 'individual', lastMessage: 'Sent the rental agreement for review', timestamp: Date.now() - 3600000, unreadCount: 0 },
    { id: '120363024888@g.us', name: 'Equipment Rental & Operations', type: 'group', lastMessage: 'Monthly maintenance invoice is approved', timestamp: Date.now() - 7200000, unreadCount: 2 },
    { id: '919822000002@s.whatsapp.net', name: 'ABC Enterprises - Accounts', type: 'individual', lastMessage: 'Wire transfer confirmed for Invoice #1042', timestamp: Date.now() - 86400000, unreadCount: 0 }
  ];
  let filtered = mockChats;
  if (q) {
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.lastMessage.toLowerCase().includes(q.toLowerCase()));
  }
  if (type) {
    filtered = filtered.filter(c => c.type === type);
  }
  res.json({ success: true, count: filtered.length, chats: filtered.slice(0, parseInt(limit, 10)) });
});

app.get('/api/chats/:chatId', (req, res) => {
  res.json({
    id: req.params.chatId,
    name: 'Rahul Sharma',
    phone: req.params.chatId.split('@')[0],
    isGroup: req.params.chatId.includes('@g.us'),
    createdAt: Date.now() - 864000000
  });
});

app.get('/api/chats/:chatId/messages', (req, res) => {
  res.json({
    chatId: req.params.chatId,
    messages: [
      { id: 'wa-msg-1', sender: 'Rahul Sharma', text: 'Hi, sharing the equipment rental quotation.', timestamp: Date.now() - 100000 },
      { id: 'wa-msg-2', sender: 'Me', fromMe: true, text: 'Thanks Rahul, what is the agreed monthly payment?', timestamp: Date.now() - 80000 },
      { id: 'wa-msg-3', sender: 'Rahul Sharma', text: 'The agreed amount is INR 45,000 per month including GST.', timestamp: Date.now() - 50000 }
    ]
  });
});

app.get('/api/chats/:chatId/transcript', (req, res) => {
  res.json({
    chatId: req.params.chatId,
    transcript: `[2026-10-31 10:15] Rahul Sharma: Hi, sharing the equipment rental quotation.\n[2026-10-31 10:18] Me: Thanks Rahul, what is the agreed monthly payment?\n[2026-10-31 10:20] Rahul Sharma: The agreed amount is INR 45,000 per month including GST.`
  });
});

// 6. GET /api/messages
app.get('/api/messages', (req, res) => {
  const { q, limit = 50 } = req.query;
  const messages = [
    { id: 'msg-001', chatId: '919822000001@s.whatsapp.net', sender: 'Rahul Sharma', fromMe: false, text: 'Quotation for equipment rental is INR 45,000/month', timestamp: Date.now() - 120000 },
    { id: 'msg-002', chatId: '120363024888@g.us', sender: 'Finance Team', fromMe: false, text: 'Invoice #1042 payment verified', timestamp: Date.now() - 360000 },
    { id: 'msg-003', chatId: '919822000001@s.whatsapp.net', sender: 'Me', fromMe: true, text: 'Confirmed. We will execute the rental agreement.', timestamp: Date.now() - 50000 }
  ];
  let filtered = messages;
  if (q) {
    filtered = filtered.filter(m => m.text.toLowerCase().includes(q.toLowerCase()));
  }
  res.json({ success: true, count: filtered.length, messages: filtered.slice(0, parseInt(limit, 10)) });
});

app.get('/api/messages/:id/context', (req, res) => {
  res.json({
    targetId: req.params.id,
    before: [
      { id: 'prev-1', text: 'Regarding our discussion yesterday...', timestamp: Date.now() - 200000 }
    ],
    target: { id: req.params.id, text: 'Quotation for equipment rental is INR 45,000/month', timestamp: Date.now() - 120000 },
    after: [
      { id: 'next-1', text: 'Confirmed. We will execute the rental agreement.', timestamp: Date.now() - 50000 }
    ]
  });
});

// 7. GET /api/contacts
app.get('/api/contacts', (req, res) => {
  res.json({
    success: true,
    contacts: [
      { id: '919822000001@s.whatsapp.net', name: 'Rahul Sharma', phone: '+91 98220 00001', company: 'ABC Enterprises' },
      { id: '919822000002@s.whatsapp.net', name: 'Imran Khan', phone: '+91 98220 00002', company: 'NuageCX' },
      { id: '919822000003@s.whatsapp.net', name: 'Pooja Patil', phone: '+91 98220 00003', company: 'Client Ops' }
    ]
  });
});

// 8. GET /api/groups
app.get('/api/groups', (req, res) => {
  res.json({
    success: true,
    groups: [
      { id: '120363024888@g.us', subject: 'Equipment Rental & Operations', participantCount: 12, owner: '919822000001@s.whatsapp.net' },
      { id: '120363024999@g.us', subject: 'Project Alpha Operations', participantCount: 8, owner: '919822000003@s.whatsapp.net' }
    ]
  });
});

// 9. GET /api/search/all?q=test&scope=all
app.get('/api/search/all', (req, res) => {
  const { q = '', scope = 'all' } = req.query;
  res.json({
    query: q,
    scope,
    matches: [
      { source: 'whatsapp_message', id: 'msg-001', matchText: 'Rental test agreement discussed', chat: 'Rahul Sharma' },
      { source: 'whatsapp_contact', id: 'c-01', matchText: 'Test Client Contact', phone: '+91 98220 00001' }
    ],
    count: 2
  });
});

app.get('/api/search', (req, res) => {
  const { q = '' } = req.query;
  res.json({
    query: q,
    results: [
      { id: 'msg-001', text: `Message mentioning ${q}`, sender: 'Rahul Sharma', timestamp: Date.now() }
    ]
  });
});

// 10. POST /api/sync/groups
app.post('/api/sync/groups', (req, res) => {
  res.json({
    success: true,
    syncedCount: 14,
    timestamp: new Date().toISOString(),
    message: 'Synchronized 14 WhatsApp group names and participants successfully.'
  });
});

// 11. GET /api/analytics/daily?tzOffset=330
app.get('/api/analytics/daily', (req, res) => {
  const { tzOffset = 330 } = req.query;
  res.json({
    type: 'daily',
    tzOffset: Number(tzOffset),
    metrics: {
      messagesSent: 42,
      messagesReceived: 128,
      activeChats: 18,
      peakHour: 15,
      mediaCount: 14
    },
    days: [
      { date: '2026-10-29', sent: 35, received: 110 },
      { date: '2026-10-30', sent: 48, received: 142 },
      { date: '2026-10-31', sent: 42, received: 128 }
    ]
  });
});

// 12. GET /api/connector/search?query=test&scope=all&limit=10
app.get('/api/connector/search', (req, res) => {
  const { query: q = '', scope = 'all', limit = 10 } = req.query;
  res.json({
    query: q,
    scope,
    limit: Number(limit),
    results: [
      {
        id: 'wa-connector-001',
        platform: 'whatsapp',
        type: 'message',
        title: 'Rental Agreement Discussion',
        snippet: `Agreed upon INR 45,000 monthly rental with Rahul Sharma matching "${q}"`,
        metadata: {
          chatId: '919822000001@s.whatsapp.net',
          sender: 'Rahul Sharma',
          timestamp: Date.now() - 7200000
        }
      }
    ]
  });
});

// MCP Support: POST /mcp
app.post('/mcp', (req, res) => {
  res.json({
    jsonrpc: '2.0',
    result: {
      content: [
        {
          type: 'text',
          text: 'MCP executed WhatsApp knowledge retrieval: Retrieved verified payment commitments (INR 45,000/mo rental) and Invoice #1042 status.'
        }
      ]
    }
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[WhatsApp Mock Service] Listening on http://127.0.0.1:${PORT}`);
});
