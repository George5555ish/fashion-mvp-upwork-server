import express from 'express';
import {
  createCollection,
  deleteCollection,
  listAdminCollections,
  updateCollection,
} from '../controllers/curatedCollectionController.js';
import {
  createLook,
  deleteLook,
  listAdminLooks,
  updateLook,
} from '../controllers/curatedLookController.js';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware.js';
import { imageUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/collections', listAdminCollections);
router.post('/collections', createCollection);
router.put('/collections/:collectionId', updateCollection);
router.delete('/collections/:collectionId', deleteCollection);

router.get('/looks', listAdminLooks);
router.post('/looks', imageUpload.single('image'), createLook);
router.put('/looks/:lookId', imageUpload.single('image'), updateLook);
router.delete('/looks/:lookId', deleteLook);

export default router;
