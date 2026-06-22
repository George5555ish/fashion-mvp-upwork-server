import express from 'express';
import {
  createClosetItem,
  createOutfit,
  deleteClosetItem,
  deleteOutfit,
  listClosetItems,
  listOutfits,
  shareOutfit,
} from '../controllers/closetController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { imageUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/items', listClosetItems);
router.post('/items', imageUpload.single('image'), createClosetItem);
router.delete('/items/:itemId', deleteClosetItem);

router.get('/outfits', listOutfits);
router.post('/outfits', createOutfit);
router.post('/outfits/:outfitId/share', shareOutfit);
router.delete('/outfits/:outfitId', deleteOutfit);

export default router;
