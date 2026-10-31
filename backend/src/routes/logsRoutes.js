import express from 'express';
import { getLogs, clearLogs, exportLogs } from '../controllers/logsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getLogs);
router.delete('/', authenticateToken, clearLogs);
router.get('/export', authenticateToken, exportLogs);

export default router;
