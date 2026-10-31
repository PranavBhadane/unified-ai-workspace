import express from 'express';
import {
  getMessages,
  getThreads,
  searchEmails
} from '../controllers/gmailController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/messages', authenticateToken, getMessages);
router.get('/threads', authenticateToken, getThreads);
router.get('/search', authenticateToken, searchEmails);

export default router;
