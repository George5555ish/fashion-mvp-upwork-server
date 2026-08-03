import express from 'express';
import {
  getPublishedLook,
  getPublishedLookImage,
  listPublishedLooks,
} from '../controllers/curatedLookController.js';

const router = express.Router();

router.get('/', listPublishedLooks);
router.get('/:lookId/image', getPublishedLookImage);
router.get('/:lookId', getPublishedLook);

export default router;
