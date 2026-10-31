import express from 'express';
import {
  chat,
  getConversations,
  createConversation,
  getConversation,
  getMessageSources,
  getProviderConfigs,
  saveProviderConfig,
  removeProviderConfig,
  testProviderConnection,
  setDefaultProvider,
  getAvailableModels
} from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Chat & Conversations
router.post('/chat', authenticateToken, chat);
router.get('/conversations', authenticateToken, getConversations);
router.post('/conversations', authenticateToken, createConversation);
router.get('/conversations/:id', authenticateToken, getConversation);
router.get('/sources/:messageId', authenticateToken, getMessageSources);

// Multi-Provider Configuration
router.get('/providers', authenticateToken, getProviderConfigs);
router.post('/providers', authenticateToken, saveProviderConfig);
router.delete('/providers/:provider', authenticateToken, removeProviderConfig);
router.post('/providers/:provider/test', authenticateToken, testProviderConnection);
router.post('/providers/default', authenticateToken, setDefaultProvider);

// Dynamic Models Discovery
router.get('/models', authenticateToken, getAvailableModels);

export default router;
