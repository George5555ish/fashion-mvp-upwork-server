import express from 'express';
import { getSharedOutfit, getSharedOutfitItemImage } from '../controllers/closetController.js';

const router = express.Router();

router.get('/outfits/:shareId/items/:itemId/image', getSharedOutfitItemImage);
router.get('/outfits/:shareId', getSharedOutfit);

export default router;
