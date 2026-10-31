import { Router } from 'express';
import {
  generateReport,
  listReports,
  getReport,
  downloadReport,
  deleteReport
} from '../controllers/reportController.js';

const router = Router();

router.post('/generate', generateReport);
router.get('/', listReports);
router.get('/:id', getReport);
router.get('/:id/download', downloadReport);
router.delete('/:id', deleteReport);

export default router;
