import type { Request, Response } from 'express';
import { db } from '../../infrastructure/database/drizzle';
import { adminRecordIdSchema } from './admin.schemas';
import { AdminError } from './admin.errors';
import { adminEmailVerificationReasonSchema } from './admin.email-verification.schemas';
import {
  getAdminEmailVerificationDetails,
  manuallyVerifyEmail,
  resendAdminVerificationEmail,
} from './admin.email-verification.service';

function handleEmailVerificationError(res: Response, error: unknown) {
  if (error instanceof AdminError) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error('[admin] Email verification request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Email verification management request failed.' });
}

function actorFromRequest(req: Request) {
  return {
    userId: req.user!.userId,
    fullName: req.user!.fullName,
    requestId: String(req.headers['x-request-id'] ?? ''),
  };
}

export async function manuallyVerifyEmployerEmailController(req: Request, res: Response) {
  try {
    const employerId = adminRecordIdSchema.safeParse(req.params.id);
    if (!employerId.success) return res.status(400).json({ success: false, error: 'Invalid employer identifier.' });
    const target = await db.query<{ userId: string }>(
      'SELECT "userId" FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NULL',
      [employerId.data],
    );
    if (!target.rows[0]) return res.status(404).json({ success: false, error: 'Employer account not found.' });
    req.params.id = target.rows[0].userId;
    return manuallyVerifyUserEmailController(req, res);
  } catch (error) {
    return handleEmailVerificationError(res, error);
  }
}

export async function resendEmployerVerificationEmailController(req: Request, res: Response) {
  try {
    const employerId = adminRecordIdSchema.safeParse(req.params.id);
    if (!employerId.success) return res.status(400).json({ success: false, error: 'Invalid employer identifier.' });
    const target = await db.query<{ userId: string }>(
      'SELECT "userId" FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NULL',
      [employerId.data],
    );
    if (!target.rows[0]) return res.status(404).json({ success: false, error: 'Employer account not found.' });
    req.params.id = target.rows[0].userId;
    return resendUserVerificationEmailController(req, res);
  } catch (error) {
    return handleEmailVerificationError(res, error);
  }
}

export async function getUserEmailVerificationDetailsController(req: Request, res: Response) {
  const id = adminRecordIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, error: 'Invalid account identifier.' });
  try {
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      data: await getAdminEmailVerificationDetails(id.data),
    });
  } catch (error) {
    return handleEmailVerificationError(res, error);
  }
}

export async function manuallyVerifyUserEmailController(req: Request, res: Response) {
  const actor = actorFromRequest(req);
  const id = adminRecordIdSchema.safeParse(req.params.id);
  const parsed = adminEmailVerificationReasonSchema.safeParse(req.body);
  if (!id.success) return res.status(400).json({ success: false, error: 'Invalid account identifier.' });
  if (!parsed.success) return res.status(400).json({ success: false, error: 'A reason of 3 to 500 characters is required.' });

  try {
    const result = await manuallyVerifyEmail(id.data, actor, parsed.data.reason);
    if (result === 'not_found') return res.status(404).json({ success: false, error: 'User account not found.' });
    if (result === 'self_verification') return res.status(403).json({ success: false, error: 'Administrators cannot manually verify their own email.' });
    if (result === 'already_verified') return res.status(409).json({ success: false, error: 'This email is already verified.' });
    if (result === 'action_required') return res.status(409).json({ success: false, error: 'Verification records conflict. Review the account history before taking action.' });
    return res.json({ success: true, message: 'Email marked verified after administrator review. Account status was not changed.' });
  } catch (error) {
    return handleEmailVerificationError(res, error);
  }
}

export async function resendUserVerificationEmailController(req: Request, res: Response) {
  const actor = actorFromRequest(req);
  const id = adminRecordIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, error: 'Invalid account identifier.' });

  try {
    const result = await resendAdminVerificationEmail(id.data, actor);
    return res.json({
      success: true,
      message: 'Verification email accepted by the configured email provider.',
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return handleEmailVerificationError(res, error);
  }
}
