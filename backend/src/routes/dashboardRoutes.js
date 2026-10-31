import express from 'express';
import {
  getKPIs,
  getRecentActivity,
  getDocuments
} from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/kpi', authenticateToken, getKPIs);
router.get('/recent-activity', authenticateToken, getRecentActivity);
router.get('/documents', authenticateToken, getDocuments);

export default router;
