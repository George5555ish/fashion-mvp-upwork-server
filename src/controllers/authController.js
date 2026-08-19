import User from '../models/User.js';
import {
  formatUser,
  hashPassword,
  resolveUserRole,
  signToken,
  verifyPassword,
} from '../services/authService.js';
import { isAtlasStaleAuthError, withDbRetry } from '../db/connection.js';

export async function register(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const name = req.body.name?.trim() || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await withDbRetry(() => User.findOne({ email }));
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await withDbRetry(() => User.create({
      email,
      name,
      passwordHash,
      role: resolveUserRole(email),
    }));

    const token = signToken(user);

    res.status(201).json({
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('[OutFind] Register error:', error);
    if (isAtlasStaleAuthError(error)) {
      return res.status(503).json({
        error: 'Database connection issue. Please try again in a moment.',
      });
    }
    res.status(500).json({ error: 'Failed to create account' });
  }
}

export async function login(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await withDbRetry(() => User.findOne({ email }));
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && email === adminEmail && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    const token = signToken(user);

    res.json({
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('[OutFind] Login error:', error);
    if (isAtlasStaleAuthError(error)) {
      return res.status(503).json({
        error: 'Database connection issue. Please try again in a moment.',
      });
    }
    res.status(500).json({ error: 'Failed to log in' });
  }
}

export async function getMe(req, res) {
  res.json({ user: req.authUser });
}
