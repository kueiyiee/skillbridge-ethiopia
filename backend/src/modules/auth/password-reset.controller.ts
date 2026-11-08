import type { Request, Response } from 'express';
import { AuthError } from './auth.errors';
import { forgotPasswordSchema, passwordResetSchema } from './auth.schemas';
import {
  clearPasswordResetCookie,
  clearSessionCookie,
  getPasswordResetToken,
  setPasswordResetCookie,
} from './auth.cookies';
import { sendPasswordChangedEmail, sendPasswordResetEmail } from './auth.email';
import {
  commitPasswordResetCode,
  completePasswordReset,
  preparePasswordReset,
} from './password-reset.service';

const requestId = (req: Request) => String(req.headers['x-request-id'] ?? '');
const genericRequestMessage = 'If an eligible account exists, check its inbox for a reset code. If no code arrives, wait briefly before requesting another.';

function sendGenericRequestResponse(res: Response) {
  return res.status(202).set('Cache-Control', 'no-store').json({ success: true, message: genericRequestMessage });
}

function handlePasswordResetError(res: Response, error: unknown) {
  if (error instanceof AuthError) {
    return res.status(error.statusCode).set('Cache-Control', 'no-store').json({ success: false, error: error.message });
  }
  console.error('[auth-password-reset] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).set('Cache-Control', 'no-store').json({
    success: false,
    error: 'Password recovery is temporarily unavailable. Please try again later.',
  });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const correlationId = requestId(req);
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).set('Cache-Control', 'no-store').json({ success: false, error: 'Enter a valid email address.' });
  }

  return processResetRequest(parsed.data.email, req, res, correlationId);
}

async function processResetRequest(email: string, req: Request, res: Response, correlationId: string) {
  let prepared: Awaited<ReturnType<typeof preparePasswordReset>> | undefined;
  try {
    prepared = await preparePasswordReset(email, getPasswordResetToken(req));
    if (!prepared.shouldSendEmail) {
      if (prepared.cookieToken) setPasswordResetCookie(res, prepared.cookieToken);
      console.info('[auth-password-reset] Recovery request processed.', { requestId: correlationId });
      return sendGenericRequestResponse(res);
    }

    try {
      await sendPasswordResetEmail(prepared.email, prepared.code, undefined, { requestId: correlationId });
      await commitPasswordResetCode(prepared);
      setPasswordResetCookie(res, prepared.token);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      console.warn('[auth-password-reset] Reset email was not accepted.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
      if (prepared.cookieToken) setPasswordResetCookie(res, prepared.cookieToken);
      return sendGenericRequestResponse(res);
    }

    console.info('[auth-password-reset] Recovery request processed.', { requestId: correlationId });
    return sendGenericRequestResponse(res);
  } catch (error) {
    if (error instanceof AuthError && [429, 503].includes(error.statusCode)) {
      console.warn('[auth-password-reset] Recovery request was deferred.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
      return sendGenericRequestResponse(res);
    }
    return handlePasswordResetError(res, error);
  }
}

export async function resendPasswordResetController(req: Request, res: Response) {
  const correlationId = requestId(req);
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).set('Cache-Control', 'no-store').json({ success: false, error: 'Enter a valid email address.' });
  }
  return processResetRequest(parsed.data.email, req, res, correlationId);
}

export async function resetPasswordController(req: Request, res: Response) {
  const correlationId = requestId(req);
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).set('Cache-Control', 'no-store').json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Check the reset code and password requirements.',
    });
  }

  try {
    const result = await completePasswordReset(
      parsed.data.email,
      getPasswordResetToken(req),
      parsed.data.code,
      parsed.data.newPassword,
    );
    if (!result) throw new AuthError('The reset code is invalid or expired. Request a new code and try again.', 400);
    clearPasswordResetCookie(res);
    clearSessionCookie(res);
    console.info('[auth-password-reset] Password reset completed.', { requestId: correlationId });

    try {
      await sendPasswordChangedEmail(result.email, undefined, { requestId: correlationId });
    } catch (error) {
      console.warn('[auth-password-reset] Password change notification was not accepted.', {
        requestId: correlationId,
        statusCode: error instanceof AuthError ? error.statusCode : undefined,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      message: 'Your password was reset. Sign in with your new password.',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn('[auth-password-reset] Reset verification failed.', {
        requestId: correlationId,
        statusCode: error.statusCode,
      });
    }
    return handlePasswordResetError(res, error);
  }
}
