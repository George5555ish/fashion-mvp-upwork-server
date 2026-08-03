import { verifyToken, formatUser } from '../services/authService.js';
import User from '../models/User.js';

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }

  if (typeof req.query.access_token === 'string' && req.query.access_token) {
    return req.query.access_token;
  }

  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);

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
    const token = extractBearerToken(req);

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
