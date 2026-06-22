import express from 'express';
import { login, register, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, getMe);

export default router;
