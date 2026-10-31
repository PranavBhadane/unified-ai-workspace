import express from 'express';
import {
  getQr,
  getStatus,
  getHealth,
  getStats,
  syncGroups,
  getChats,
  getChatById,
  getChatMessages,
  getChatTranscript,
  getMessages,
  getMessageById,
  getMessageContext,
  getContacts,
  getGroups,
  search,
  getAnalytics,
  exportMessages
} from '../controllers/whatsappController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// System
router.get('/qr', authenticateToken, getQr);
router.get('/status', authenticateToken, getStatus);
router.get('/live-status', authenticateToken, getStatus);
router.get('/health', authenticateToken, getHealth);
router.get('/stats', authenticateToken, getStats);
router.post('/sync/groups', authenticateToken, syncGroups);

// Chats
router.get('/chats', authenticateToken, getChats);
router.get('/chats/:chatId', authenticateToken, getChatById);
router.get('/chats/:chatId/messages', authenticateToken, getChatMessages);
router.get('/chats/:chatId/transcript', authenticateToken, getChatTranscript);

// Messages
router.get('/messages', authenticateToken, getMessages);
router.get('/messages/:id', authenticateToken, getMessageById);
router.get('/messages/:id/context', authenticateToken, getMessageContext);

// Search
router.get('/search', authenticateToken, search);

// Contacts & Groups
router.get('/contacts', authenticateToken, getContacts);
router.get('/groups', authenticateToken, getGroups);

// Analytics & Export
router.get('/analytics/:type', authenticateToken, getAnalytics);
router.get('/export/messages', authenticateToken, exportMessages);

export default router;
