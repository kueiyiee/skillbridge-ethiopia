import type { NextFunction, Request, Response } from 'express';
import { isSessionRevoked, resolveAuthenticatedUser } from '../modules/auth/auth.service';
import { verifyToken } from '../modules/auth/auth.tokens';
import { getSessionToken } from '../modules/auth/auth.cookies';
import type { AuthActor } from '../modules/auth/auth.types';

export type AuthUser = AuthActor;
export { generateToken } from '../modules/auth/auth.tokens';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required. Please sign in.' });
  }

  let decoded: AuthUser;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token. Please re-authenticate.' });
  }

  try {
    if (!decoded.sessionId || await isSessionRevoked(decoded.sessionId)) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token. Please re-authenticate.' });
    }
    const user = await resolveAuthenticatedUser(decoded.userId, decoded.authVersion);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User account not found or deactivated.' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(503).json({ success: false, error: 'Authentication service is temporarily unavailable.' });
  }
}

export function requireRole(...allowedRoles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Action requires one of: [${allowedRoles.join(', ')}] role.`,
      });
    }
    return next();
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getSessionToken(req);
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded.sessionId && !(await isSessionRevoked(decoded.sessionId))) {
        req.user = await resolveAuthenticatedUser(decoded.userId, decoded.authVersion);
      }
    } catch {
      req.user = undefined;
    }
  }
  return next();
}
