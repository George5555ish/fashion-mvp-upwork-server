import express from 'express';
import {
  addProductToAlbum,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  removeProductFromAlbum,
} from '../controllers/albumController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', listAlbums);
router.post('/', createAlbum);
router.get('/:albumId', getAlbum);
router.delete('/:albumId', deleteAlbum);
router.post('/:albumId/items', addProductToAlbum);
router.delete('/:albumId/items/:itemId', removeProductFromAlbum);

export default router;
