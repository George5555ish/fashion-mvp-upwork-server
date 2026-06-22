import express from 'express';
import {
  getPublishedLook,
  listPublishedLooks,
} from '../controllers/curatedLookController.js';

const router = express.Router();

router.get('/', listPublishedLooks);
router.get('/:lookId', getPublishedLook);

export default router;
