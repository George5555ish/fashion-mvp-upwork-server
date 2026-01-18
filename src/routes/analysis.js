import express from 'express';
import { getAnalysis } from '../controllers/analysisController.js';

const router = express.Router();

// GET /api/analysis/:uploadId - Get analysis results
router.get('/:uploadId', getAnalysis);

export default router;
