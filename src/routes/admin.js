import express from 'express';
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

router.get('/looks', listAdminLooks);
router.post('/looks', imageUpload.single('image'), createLook);
router.put('/looks/:lookId', imageUpload.single('image'), updateLook);
router.delete('/looks/:lookId', deleteLook);

export default router;
