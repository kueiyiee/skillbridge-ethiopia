import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { AuthActor } from './auth.types';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return secret;
}

export function generateToken(user: AuthActor): string {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      authVersion: user.authVersion ?? 0
    },
    getJwtSecret(),
    { expiresIn: '1h', jwtid: randomUUID() }
  );
}

export function verifyToken(token: string): AuthActor {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === 'string' || typeof payload.jti !== 'string' || typeof payload.exp !== 'number') {
    throw new Error('Invalid authentication session.');
  }
  return {
    userId: String(payload.userId ?? ''),
    email: String(payload.email ?? ''),
    role: payload.role as AuthActor['role'],
    fullName: typeof payload.fullName === 'string' ? payload.fullName : undefined,
    authVersion: typeof payload.authVersion === 'number' ? payload.authVersion : 0,
    sessionId: payload.jti,
    sessionExpiresAt: payload.exp
  };
}
