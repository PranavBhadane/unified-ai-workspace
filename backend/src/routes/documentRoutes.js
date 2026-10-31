import { Router } from 'express';
import {
  getDocuments,
  getDocumentStats,
  previewDocument,
  downloadDocument
} from '../controllers/documentController.js';

const router = Router();

router.get('/', getDocuments);
router.get('/stats', getDocumentStats);
router.get('/:docId/preview', previewDocument);
router.get('/:docId/download', downloadDocument);

export default router;
