import express from 'express';
import { getProducts, getSimilarProducts, seedProducts } from '../controllers/productController.js';

const router = express.Router();

// GET /api/products - Get all products (for admin/seeding)
router.get('/', getProducts);

// GET /api/products/similar - Get similar products based on detected items
router.get('/similar', getSimilarProducts);

// POST /api/products/seed - Seed initial product data
router.post('/seed', seedProducts);

export default router;
