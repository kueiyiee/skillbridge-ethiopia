import type { Request, Response, CookieOptions } from 'express';

export const authCookieName = 'skillbridge_session';
export const emailVerificationCookieName = 'skillbridge_email_verification';
export const passwordResetCookieName = 'skillbridge_password_reset';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
};

const emailVerificationCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth'
};

const passwordResetCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth'
};

export function getSessionToken(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearerToken) return bearerToken;

  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${authCookieName}=`));
  if (!cookie) return undefined;

  try {
    return decodeURIComponent(cookie.slice(authCookieName.length + 1));
  } catch {
    return undefined;
  }
}

export function getEmailVerificationToken(req: Request): string | undefined {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${emailVerificationCookieName}=`));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(emailVerificationCookieName.length + 1));
  } catch {
    return undefined;
  }
}

export function setEmailVerificationCookie(res: Response, token: string): void {
  res.cookie(emailVerificationCookieName, token, { ...emailVerificationCookieOptions, maxAge: 24 * 60 * 60 * 1000 });
}

export function clearEmailVerificationCookie(res: Response): void {
  res.clearCookie(emailVerificationCookieName, emailVerificationCookieOptions);
}

export function getPasswordResetToken(req: Request): string | undefined {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${passwordResetCookieName}=`));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(passwordResetCookieName.length + 1));
  } catch {
    return undefined;
  }
}

export function setPasswordResetCookie(res: Response, token: string): void {
  res.cookie(passwordResetCookieName, token, { ...passwordResetCookieOptions, maxAge: 30 * 60 * 1000 });
}

export function clearPasswordResetCookie(res: Response): void {
  res.clearCookie(passwordResetCookieName, passwordResetCookieOptions);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(authCookieName, token, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(authCookieName, cookieOptions);
}