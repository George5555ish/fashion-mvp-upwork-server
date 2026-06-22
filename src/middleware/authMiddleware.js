import { verifyToken, formatUser } from '../services/authService.js';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.userId).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = user;
    req.authUser = formatUser(user);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (token) {
      const payload = verifyToken(token);
      const user = await User.findById(payload.userId).select('-passwordHash');
      if (user) {
        req.user = user;
        req.authUser = formatUser(user);
      }
    }
  } catch {
    // Ignore invalid optional auth tokens
  }

  next();
}
