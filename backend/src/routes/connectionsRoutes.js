import express from 'express';
import {
  getConnections,
  connectPlatform,
  handleGoogleCallback,
  disconnectPlatform
} from '../controllers/connectionsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getConnections);
router.post('/:platform/connect', authenticateToken, connectPlatform);
router.get('/google/callback', handleGoogleCallback);
router.delete('/:platform', authenticateToken, disconnectPlatform);

export default router;
