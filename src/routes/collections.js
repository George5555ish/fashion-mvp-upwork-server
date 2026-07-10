import express from 'express';
import {
  getPublishedCollection,
  listPublishedCollections,
} from '../controllers/curatedCollectionController.js';

const router = express.Router();

router.get('/', listPublishedCollections);
router.get('/:collectionId', getPublishedCollection);

export default router;
