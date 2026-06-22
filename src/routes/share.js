import express from 'express';
import { getSharedOutfit } from '../controllers/closetController.js';

const router = express.Router();

router.get('/outfits/:shareId', getSharedOutfit);

export default router;
