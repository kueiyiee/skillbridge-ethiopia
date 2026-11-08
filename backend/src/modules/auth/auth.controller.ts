import type { Request, Response } from 'express';
import { AuthError } from './auth.errors';
import {
  accountDeletionSchema,
  accountUpdateSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestEmailVerificationSchema,
  verifyEmailCodeSchema,
} from './auth.schemas';
import {
  changePassword, deleteAccount, getCurrentAccount, login, readEmailVerificationStatus,
  register, requestRegistrationEmailVerification, resendRegistrationCode, revokeSession, updateAccount, verifyRegistrationCode
} from './auth.service';
import {
  clearEmailVerificationCookie, clearSessionCookie, getEmailVerificationToken,
  getSessionToken, setEmailVerificationCookie, setSessionCookie
} from './auth.cookies';
import { verifyToken } from './auth.tokens';
import {
  commitEmailVerificationChallenge,
  commitEmailVerificationResend,
  maskEmailAddress,
} from './email-verification.service';
import { assertEmailDeliveryConfigured, sendVerificationEmail } from './auth.email';

function requestId(req: Request): string {
  return String(req.headers['x-request-id'] ?? '');
}

function handleError(res: Response, error: unknown) {
  if (error instanceof AuthError) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error('[auth] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

export async function registerController(req: Request, res: Response) {
  const correlationId = requestId(req);
  console.info('[auth] Registration request received.', { requestId: correlationId });
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[auth] Registration request rejected.', { requestId: correlationId, statusCode: 400 });
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    }
    const result = await register(parsed.data);
    try {
      assertEmailDeliveryConfigured();
      if (result.deliverable) {
        await sendVerificationEmail(result.email, result.code, undefined, { requestId: correlationId });
        if (result.requiresCommit) {
          await commitEmailVerificationChallenge(result.userId, result.token, result.code);
        }
      }
    } catch (error) {
      if (error instanceof AuthError) {
        console.warn('[auth-email] Registration verification email was not accepted.', {
          requestId: correlationId,
          statusCode: error.statusCode,
        });
        return res.status(error.statusCode).set('Cache-Control', 'no-store').json({
          success: false,
          error: error.message,
          verificationPending: true
        });
      }
      throw error;
    }
    setEmailVerificationCookie(res, result.token);
    console.info('[auth] Registration request completed.', { requestId: correlationId, verificationEmailEligible: result.deliverable });
    return res.status(201).set('Cache-Control', 'no-store').json({
      success: true,
      message: 'If this email can be registered, check your inbox for the next step. If you already have an account, sign in.',
      maskedEmail: maskEmailAddress(result.email)
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function requestEmailVerificationController(req: Request, res: Response) {
  const correlationId = requestId(req);
  const parsed = requestEmailVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).set('Cache-Control', 'no-store').json({
      success: false,
      error: 'Enter a valid email address.',
    });
  }

  const genericMessage = 'If verification is needed, check your inbox for a six-digit code. If no message arrives, wait before requesting another code.';
  const genericResponse = () => res.status(202).set('Cache-Control', 'no-store').json({
    success: true,
    message: genericMessage,
  });
  let result: Awaited<ReturnType<typeof requestRegistrationEmailVerification>>;
  try {
    result = await requestRegistrationEmailVerification(parsed.data.email);
  } catch (error) {
    if (error instanceof AuthError && error.statusCode === 429) {
      console.warn('[auth-email] Verification request reached a send limit.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
      return genericResponse();
    }
    return handleError(res, error);
  }

  try {
    assertEmailDeliveryConfigured();
    if (result.deliverable) {
      await sendVerificationEmail(result.email, result.code, undefined, { requestId: correlationId });
      if (result.requiresCommit) {
        await commitEmailVerificationChallenge(result.userId, result.token, result.code);
      }
    }
    setEmailVerificationCookie(res, result.token);
    return res.status(202).set('Cache-Control', 'no-store').json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    if (error instanceof AuthError && error.statusCode === 429) {
      console.warn('[auth-email] Verification request reached a send limit.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
      return genericResponse();
    }
    if (error instanceof AuthError) {
      console.warn('[auth-email] Verification email request did not complete.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
      return res.status(error.statusCode).set('Cache-Control', 'no-store').json({
        success: false,
        error: error.message,
      });
    }
    return handleError(res, error);
  }
}

export async function emailVerificationStatusController(req: Request, res: Response) {
  try {
    const status = await readEmailVerificationStatus(getEmailVerificationToken(req));
    return res.set('Cache-Control', 'no-store').json({ success: true, ...status });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function resendEmailVerificationController(req: Request, res: Response) {
  const correlationId = requestId(req);
  console.info('[auth-email] Verification resend request received.', { requestId: correlationId });
  try {
    const result = await resendRegistrationCode(getEmailVerificationToken(req));
    try {
      assertEmailDeliveryConfigured();
      if (result.shouldSendEmail) {
        await sendVerificationEmail(result.email, result.code, undefined, { requestId: correlationId });
        await commitEmailVerificationResend(getEmailVerificationToken(req), result.code);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        console.warn('[auth-email] Verification resend did not complete.', {
          requestId: correlationId,
          statusCode: error.statusCode,
        });
        return res.status(error.statusCode).set('Cache-Control', 'no-store').json({ success: false, error: error.message });
      }
      throw error;
    }
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      message: 'If this address needs verification, a new code will arrive shortly.',
      resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
      expiresAt: result.expiresAt
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn('[auth-email] Verification resend request was rejected.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
    }
    return handleError(res, error);
  }
}

export async function verifyEmailController(req: Request, res: Response) {
  const correlationId = requestId(req);
  try {
    const parsed = verifyEmailCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[auth-email] OTP verification failed.', { requestId: correlationId, statusCode: 400 });
      return res.status(400).json({ success: false, error: 'Enter the six-digit verification code.' });
    }
    const result = await verifyRegistrationCode(getEmailVerificationToken(req), parsed.data.code);
    clearEmailVerificationCookie(res);
    setSessionCookie(res, result.token);
    console.info('[auth-email] OTP verification succeeded.', { requestId: correlationId });
    return res.set('Cache-Control', 'no-store').json({ success: true, user: result.user });
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn('[auth-email] OTP verification failed.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
    }
    return handleError(res, error);
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid email/username or password.' });
    const result = await login(parsed.data);
    setSessionCookie(res, result.token);
    const { token: _token, ...response } = result;
    return res.set('Cache-Control', 'no-store').json({ success: true, ...response });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function currentAccountController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.set('Cache-Control', 'no-store').json({ success: true, user: null, profile: null });
    }
    const result = await getCurrentAccount(req.user!);
    return res.set('Cache-Control', 'no-store').json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateAccountController(req: Request, res: Response) {
  try {
    const parsed = accountUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    }
    return res.json({ success: true, ...(await updateAccount(req.user!, parsed.data)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function changePasswordController(req: Request, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Password requirements were not met.', details: parsed.error.format() });
  }

  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required. Please sign in again.' });

  try {
    const session = verifyToken(token);
    const result = await changePassword(req.user!, parsed.data, session);
    setSessionCookie(res, result.token);
    return res.set('Cache-Control', 'no-store').json({ success: true, message: result.message });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function deleteAccountController(req: Request, res: Response) {
  try {
    const parsed = accountDeletionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Current password is required to verify account deletion request.' });
    }
    return res.json({ success: true, ...(await deleteAccount(req.user!, parsed.data.password)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function logoutController(req: Request, res: Response) {
  clearSessionCookie(res);
  const token = getSessionToken(req);
  if (token) {
    let session;
    try {
      session = verifyToken(token);
    } catch {
      return res.set('Cache-Control', 'no-store').json({ success: true, message: 'Signed out successfully' });
    }
    if (session.sessionId && session.sessionExpiresAt) {
      try {
        await revokeSession(session.sessionId, session.sessionExpiresAt);
      } catch {
        return res.status(503).set('Cache-Control', 'no-store').json({
          success: false,
          error: 'The session could not be invalidated. Please try again.'
        });
      }
    }
  }
  return res.set('Cache-Control', 'no-store').json({ success: true, message: 'Signed out successfully' });
}
