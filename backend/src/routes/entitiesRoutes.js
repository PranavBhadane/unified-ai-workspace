import express from 'express';
import {
  getEntities,
  getEntity,
  getEntityTimeline,
  getEntityDocuments,
  triggerCorrelation
} from '../controllers/entitiesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getEntities);
router.get('/:id', authenticateToken, getEntity);
router.get('/:id/timeline', authenticateToken, getEntityTimeline);
router.get('/:id/documents', authenticateToken, getEntityDocuments);
router.post('/correlate', authenticateToken, triggerCorrelation);

export default router;
