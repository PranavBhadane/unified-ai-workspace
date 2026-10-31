import { Router } from 'express';
import {
  listDashboards,
  getDashboard,
  generateDashboardWithAI,
  deleteDashboard
} from '../controllers/dashboardBuilderController.js';

const router = Router();

router.get('/', listDashboards);
router.get('/:id', getDashboard);
router.post('/generate-ai', generateDashboardWithAI);
router.delete('/:id', deleteDashboard);

export default router;
