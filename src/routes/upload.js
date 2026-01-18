import express from 'express';
import { uploadImage } from '../controllers/uploadController.js';

const router = express.Router();

// POST /api/upload - Handle image upload and trigger OpenAI Vision analysis
router.post('/', uploadImage);

export default router;
