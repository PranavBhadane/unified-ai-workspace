import express from 'express';
import {
  getStatus,
  getHistory,
  startSync,
  stopSync,
  syncGroups
} from '../controllers/syncController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', authenticateToken, getStatus);
router.get('/history', authenticateToken, getHistory);
router.post('/start', authenticateToken, startSync);
router.post('/stop', authenticateToken, stopSync);
router.post('/groups', authenticateToken, syncGroups);

export default router;
