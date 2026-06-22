import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_EXPIRES_IN = '7d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function resolveUserRole(email) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email.toLowerCase() === adminEmail) {
    return 'admin';
  }
  return 'user';
}

export function formatUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
