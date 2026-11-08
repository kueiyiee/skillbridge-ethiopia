import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import { AuthError } from '../auth/auth.errors';
import { commitAdminEmailVerificationResend, prepareAdminEmailVerificationResend } from '../auth/email-verification.service';
import { getAdminEmailVerificationStatus } from './admin.policy';
import { AdminError } from './admin.errors';
import type { AdminActor } from './admin.types';

export interface AdminEmailVerificationActor extends AdminActor {
  requestId: string;
}

function mapAuthError(error: AuthError): AdminError {
  switch (error.statusCode) {
    case 400:
    case 404:
    case 409:
    case 429:
    case 503:
      return new AdminError(error.message, error.statusCode);
    default:
      return new AdminError('This account is not eligible for that verification action.', 409);
  }
}

function auditDetails(outcome: string, actor: AdminEmailVerificationActor, reason?: string): string {
  return JSON.stringify({
    outcome,
    reason: reason ?? null,
    requestId: actor.requestId,
  });
}

async function writeAudit(
  query: (sql: string, params?: unknown[]) => Promise<unknown>,
  actor: AdminEmailVerificationActor,
  userId: string,
  action: string,
  outcome: string,
  reason?: string,
): Promise<void> {
  await query(
    `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
     VALUES ($1, $2, $3, 'User', $4, $5)`,
    [`audit-${randomUUID()}`, actor.userId, action, userId, auditDetails(outcome, actor, reason)],
  );
}

export async function manuallyVerifyEmail(
  userId: string,
  actor: AdminEmailVerificationActor,
  reason: string,
): Promise<'updated' | 'not_found' | 'already_verified' | 'self_verification' | 'action_required'> {
  if (actor.userId === userId) return 'self_verification';
  return db.transaction(async ({ query }) => {
    const target = await query<{
      id: string;
      emailVerified: boolean;
      emailVerificationMethod: string | null;
      emailVerifiedAt: Date | string | null;
      isActive: boolean;
      role: string;
    }>(
      `SELECT id, "emailVerified", "emailVerificationMethod", "emailVerifiedAt", "isActive", role
       FROM users WHERE id = $1 AND "archivedAt" IS NULL FOR UPDATE`,
      [userId],
    );
    if (target.rowCount === 0) {
      await writeAudit(query, actor, userId, 'ADMIN_EMAIL_VERIFICATION_FAILED', 'not_found', reason);
      return 'not_found';
    }
    const previous = target.rows[0];
    if (previous.role === 'ADMIN') {
      await writeAudit(query, actor, userId, 'ADMIN_EMAIL_VERIFICATION_FAILED', 'otp_required_for_admin', reason);
      return 'action_required';
    }
    const evidence = await query<{ verifiedAt: Date | string }>(
      'SELECT "verifiedAt" FROM email_verification_challenges WHERE "userId" = $1 AND "verifiedAt" IS NOT NULL LIMIT 1',
      [userId],
    );
    const hasVerificationEvidence = ['email_otp', 'admin_manual'].includes(previous.emailVerificationMethod ?? '')
      || previous.emailVerifiedAt !== null
      || evidence.rowCount > 0;
    if (previous.emailVerified && hasVerificationEvidence) {
      await writeAudit(query, actor, userId, 'ADMIN_EMAIL_VERIFICATION_FAILED', 'already_verified', reason);
      return 'already_verified';
    }

    const needsManualEvidence = !hasVerificationEvidence;
    const updated = await query(
      needsManualEvidence
        ? `UPDATE users SET "emailVerified" = true, "emailVerificationMethod" = 'admin_manual',
           "emailVerifiedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1 AND "archivedAt" IS NULL AND "emailVerified" = $2`
        : `UPDATE users SET "emailVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1 AND "archivedAt" IS NULL AND "emailVerified" = $2`,
      [userId, previous.emailVerified],
    );
    if (updated.rowCount !== 1) {
      await writeAudit(query, actor, userId, 'ADMIN_EMAIL_VERIFICATION_FAILED', 'action_required', reason);
      return 'already_verified';
    }

    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, 'ADMIN_EMAIL_VERIFIED_MANUALLY', 'User', $3, $4)`,
      [
        `audit-${randomUUID()}`,
        actor.userId,
        userId,
        JSON.stringify({
          outcome: 'success',
          previousState: {
            emailVerified: previous.emailVerified,
            emailVerificationMethod: previous.emailVerificationMethod,
            emailVerifiedAt: previous.emailVerifiedAt,
            isActive: previous.isActive,
          },
          newState: {
            emailVerified: true,
            emailVerificationMethod: needsManualEvidence ? 'admin_manual' : previous.emailVerificationMethod,
            isActive: previous.isActive,
          },
          evidenceSource: needsManualEvidence ? 'administrator_attestation' : 'existing_verification_evidence',
          reason,
          requestId: actor.requestId,
        }),
      ],
    );
    return 'updated';
  });
}

export async function recordAdminEmailVerificationResend(
  userId: string,
  actor: AdminEmailVerificationActor,
  outcome: 'success' | 'failure',
): Promise<void> {
  await db.query(
    `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
     VALUES ($1, $2, $3, 'User', $4, $5)`,
    [
      `audit-${randomUUID()}`,
      actor.userId,
      outcome === 'success' ? 'ADMIN_VERIFICATION_EMAIL_RESEND' : 'ADMIN_VERIFICATION_EMAIL_RESEND_FAILED',
      userId,
      auditDetails(outcome, actor),
    ],
  );
}

export async function resendAdminVerificationEmail(userId: string, actor: AdminEmailVerificationActor) {
  let challenge: Awaited<ReturnType<typeof prepareAdminEmailVerificationResend>>;
  try {
    const target = await db.query<{
      emailVerified: boolean;
      isActive: boolean;
      role: string;
      emailVerificationMethod: string | null;
      emailVerifiedAt: Date | string | null;
      challengeVerifiedAt: Date | string | null;
    }>(
      `SELECT "emailVerified", "isActive", role, "emailVerificationMethod", "emailVerifiedAt",
        (SELECT MAX(evc."verifiedAt") FROM email_verification_challenges evc
         WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL) AS "challengeVerifiedAt"
       FROM users
       WHERE id = $1 AND "archivedAt" IS NULL`,
      [userId],
    );
    if (!target.rows[0]) throw new AdminError('User account not found.', 404);
    if (
      target.rows[0].emailVerified
      || target.rows[0].isActive
      || target.rows[0].emailVerificationMethod
      || target.rows[0].emailVerifiedAt
      || target.rows[0].challengeVerifiedAt
    ) {
      throw new AdminError('This account is not eligible for OTP resend. Review its verification state.', 409);
    }
    challenge = await prepareAdminEmailVerificationResend(userId);
  } catch (error) {
    await recordAdminEmailVerificationResend(userId, actor, 'failure');
    if (error instanceof AuthError) throw mapAuthError(error);
    throw error;
  }

  const { sendVerificationEmail } = await import('../auth/auth.email');
  try {
    await sendVerificationEmail(challenge.email, challenge.code, undefined, { requestId: actor.requestId });
    await commitAdminEmailVerificationResend(userId, challenge.code);
  } catch (error) {
    await recordAdminEmailVerificationResend(userId, actor, 'failure');
    if (error instanceof AuthError) throw mapAuthError(error);
    throw error;
  }
  await recordAdminEmailVerificationResend(userId, actor, 'success');
  return { expiresAt: challenge.expiresAt };
}

export async function getAdminEmailVerificationDetails(userId: string) {
  const userResult = await db.query<{
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    accountStatus: string;
    emailVerified: boolean;
    emailVerificationMethod: string | null;
    emailVerifiedAt: Date | string | null;
    createdAt: Date | string;
  }>(
    `SELECT id, email, "fullName", phone, role, "isActive",
      CASE
        WHEN "isActive" = true THEN 'active'
        WHEN "emailVerified" = false AND NOT EXISTS (
          SELECT 1 FROM platform_audit_logs moderation
          WHERE moderation."entityType" = 'User' AND moderation."entityId" = users.id
            AND moderation.action = 'USER_SUSPENDED'
            AND moderation."createdAt" = (
              SELECT MAX(latest."createdAt") FROM platform_audit_logs latest
              WHERE latest."entityType" = 'User' AND latest."entityId" = users.id
                AND latest.action IN ('USER_SUSPENDED', 'USER_ACTIVATED')
            )
        ) THEN 'pending_verification'
        ELSE 'suspended'
      END AS "accountStatus",
      "emailVerified",
      "emailVerificationMethod", "emailVerifiedAt", "createdAt"
     FROM users WHERE id = $1 AND "archivedAt" IS NULL`,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) throw new AdminError('User account not found.', 404);

  const [challengeResult, auditResult] = await Promise.all([
    db.query<{
      createdAt: Date | string;
      lastSentAt: Date | string;
      expiresAt: Date | string;
      verifiedAt: Date | string | null;
      failedAttempts: number;
    }>(
      `SELECT "createdAt", "lastSentAt", "expiresAt", "verifiedAt", "failedAttempts"
       FROM email_verification_challenges WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [userId],
    ),
    db.query<{
      id: string;
      action: string;
      details: string | null;
      createdAt: Date | string;
      actorName: string | null;
    }>(
      `SELECT log.id, log.action, log.details, log."createdAt", actor."fullName" AS "actorName"
       FROM platform_audit_logs log LEFT JOIN users actor ON actor.id = log."userId"
       WHERE log."entityType" = 'User' AND log."entityId" = $1
         AND log.action IN ('USER_REGISTERED', 'USER_SUSPENDED', 'USER_ACTIVATED',
           'ADMIN_EMAIL_VERIFIED_MANUALLY', 'ADMIN_EMAIL_VERIFICATION_FAILED',
           'ADMIN_VERIFICATION_EMAIL_RESEND', 'ADMIN_VERIFICATION_EMAIL_RESEND_FAILED')
       ORDER BY log."createdAt" DESC LIMIT 50`,
      [userId],
    ),
  ]);
  return {
    user: {
      ...user,
      emailVerificationStatus: getAdminEmailVerificationStatus(
        user.emailVerified,
        user.emailVerificationMethod,
        user.emailVerifiedAt,
        challengeResult.rows[0]?.verifiedAt ?? null,
        user.isActive,
      ),
    },
    challenge: challengeResult.rows[0] ?? null,
    auditHistory: auditResult.rows.map((event) => {
      let reason: string | null = null;
      if (event.details) {
        try {
          const parsed = JSON.parse(event.details) as { reason?: unknown };
          reason = typeof parsed.reason === 'string' ? parsed.reason : null;
        } catch {
          reason = event.details;
        }
      }
      return { id: event.id, action: event.action, reason, createdAt: event.createdAt, actorName: event.actorName };
    }),
  };
}
