import express from 'express';
import {
  getSettings,
  updateSettings,
  getStorageStats
} from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getSettings);
router.post('/', authenticateToken, updateSettings);
router.get('/storage-stats', authenticateToken, getStorageStats);

export default router;
