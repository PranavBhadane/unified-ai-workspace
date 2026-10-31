import express from 'express';
import {
  getFiles,
  getFolders,
  searchDrive
} from '../controllers/driveController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/files', authenticateToken, getFiles);
router.get('/folders', authenticateToken, getFolders);
router.get('/search', authenticateToken, searchDrive);

export default router;
