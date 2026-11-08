import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../../infrastructure/database/drizzle';
import { AuthError } from './auth.errors';
import { getEmailOtpTtlMinutes } from './auth.email-verification.config';

const RESET_RESEND_COOLDOWN_MS = 60_000;
const RESET_SEND_HOUR_LIMIT = 5;
const RESET_SEND_DAY_LIMIT = 10;
const RESET_MAX_FAILED_ATTEMPTS = 5;

interface PasswordResetRow {
  id: string;
  userId: string | null;
  email: string;
  isDecoy: boolean;
  tokenHash: string;
  codeHash: string;
  expiresAt: Date | string;
  lastSentAt: Date | string;
  hourWindowStartedAt: Date | string;
  sendsInHour: number;
  dayWindowStartedAt: Date | string;
  sendsInDay: number;
  failedAttempts: number;
  consumedAt: Date | string | null;
  createdAt: Date | string;
}

const genericResetError = 'The reset code is invalid or expired. Request a new code and try again.';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPasswordResetOtpDigest(userId: string, tokenHash: string, code: string): string {
  const secret = process.env.EMAIL_OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new AuthError('Password recovery is temporarily unavailable. Please try again later.', 503);
  }
  return createHmac('sha256', secret).update(`password-reset:${userId}:${tokenHash}:${code}`).digest('hex');
}

function compareDigest(stored: string, candidate: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(stored) || !/^[a-f0-9]{64}$/i.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(candidate, 'hex'));
}

function millis(value: Date | string | null): number | null {
  if (value === null) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function assertSendAllowed(row: Pick<PasswordResetRow,
  'lastSentAt' | 'hourWindowStartedAt' | 'sendsInHour' | 'dayWindowStartedAt' | 'sendsInDay'>,
  now: number,
): void {
  if (now - (millis(row.lastSentAt) ?? 0) < RESET_RESEND_COOLDOWN_MS) {
    throw new AuthError('Please wait before requesting another reset code.', 429);
  }
  const hourStart = millis(row.hourWindowStartedAt) ?? now;
  const dayStart = millis(row.dayWindowStartedAt) ?? now;
  if (now - hourStart < 60 * 60_000 && row.sendsInHour >= RESET_SEND_HOUR_LIMIT) {
    throw new AuthError('Too many reset code requests. Try again later.', 429);
  }
  if (now - dayStart < 24 * 60 * 60_000 && row.sendsInDay >= RESET_SEND_DAY_LIMIT) {
    throw new AuthError('Too many reset code requests. Try again tomorrow.', 429);
  }
}

function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function opaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

function nextSendCounters(row: PasswordResetRow, now: number) {
  const hourStart = millis(row.hourWindowStartedAt) ?? now;
  const dayStart = millis(row.dayWindowStartedAt) ?? now;
  return {
    resetHour: now - hourStart >= 60 * 60_000,
    resetDay: now - dayStart >= 24 * 60 * 60_000,
  };
}

export interface PreparedPasswordReset {
  email: string;
  userId?: string;
  code: string;
  token: string;
  cookieToken?: string;
  shouldSendEmail: boolean;
  commitOnAcceptance: boolean;
  challengeId: string;
}

async function loadChallengeForUpdate(
  query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }>,
  tokenHash: string,
  forUpdate = true,
) {
  const result = await query<PasswordResetRow>(
    `SELECT * FROM password_reset_challenges WHERE "tokenHash" = $1
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [tokenHash],
  );
  return result.rows[0];
}

export async function preparePasswordReset(email: string, existingToken?: string): Promise<PreparedPasswordReset> {
  const normalizedEmail = email.trim().toLowerCase();
  const token = opaqueToken();
  const tokenHash = hashToken(token);
  const code = newCode();
  const placeholderCode = newCode();
  const fallbackToken = opaqueToken();
  const fallbackTokenHash = hashToken(fallbackToken);
  const fallbackCode = newCode();
  const ttl = getEmailOtpTtlMinutes();
  const now = Date.now();
  const challengeId = `pr-${randomBytes(16).toString('hex')}`;
  const fallbackChallengeId = `pr-${randomBytes(16).toString('hex')}`;

  return db.transaction(async ({ query }) => {
    await query('DELETE FROM password_reset_challenges WHERE "expiresAt" < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
    await query(
      `INSERT INTO password_reset_challenges
       (id, "userId", email, "isDecoy", "tokenHash", "codeHash", "expiresAt", "lastSentAt",
        "hourWindowStartedAt", "sendsInHour", "dayWindowStartedAt", "sendsInDay",
        "failedAttempts", "createdAt", "updatedAt")
       VALUES ($1, NULL, $2, true, $3, $4, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $5 MINUTE),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, 1, 0, CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP)`,
      [fallbackChallengeId, normalizedEmail, fallbackTokenHash, createPasswordResetOtpDigest('decoy', fallbackTokenHash, fallbackCode), ttl],
    );
    const userResult = await query<{ id: string; email: string }>(
      `SELECT id, email FROM users
       WHERE email = $1 AND "emailVerified" = true AND "isActive" = true AND "archivedAt" IS NULL
       LIMIT 1 FOR UPDATE`,
      [normalizedEmail],
    );
    const user = userResult.rows[0];
    if (!user) {
      return { email: normalizedEmail, code: fallbackCode, token: fallbackToken, cookieToken: fallbackToken, shouldSendEmail: false, commitOnAcceptance: false, challengeId: fallbackChallengeId };
    }

    const currentResult = await query<PasswordResetRow>(
      `SELECT * FROM password_reset_challenges
       WHERE "userId" = $1
       LIMIT 1 FOR UPDATE`,
      [user.id],
    );
    const current = currentResult.rows[0];
    if (current) {
      try {
        assertSendAllowed(current, now);
      } catch (error) {
        if (!(error instanceof AuthError) || error.statusCode !== 429) throw error;
        const reuseExistingToken = existingToken && hashToken(existingToken) === current.tokenHash;
        return {
          email: normalizedEmail,
          code: fallbackCode,
          token: fallbackToken,
          cookieToken: reuseExistingToken ? existingToken : fallbackToken,
          shouldSendEmail: false,
          commitOnAcceptance: false,
          challengeId: fallbackChallengeId,
        };
      }
      const { resetHour, resetDay } = nextSendCounters(current, now);
      if (!current.consumedAt) {
        await query(
          `UPDATE password_reset_challenges SET "lastSentAt" = CURRENT_TIMESTAMP,
           "hourWindowStartedAt" = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE "hourWindowStartedAt" END,
           "sendsInHour" = CASE WHEN $1 THEN 1 ELSE "sendsInHour" + 1 END,
           "dayWindowStartedAt" = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE "dayWindowStartedAt" END,
           "sendsInDay" = CASE WHEN $2 THEN 1 ELSE "sendsInDay" + 1 END,
           "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
          [resetHour, resetDay, current.id],
        );
      } else {
        await query(
          `UPDATE password_reset_challenges SET "tokenHash" = $1, "codeHash" = $2,
           "expiresAt" = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $3 MINUTE), "lastSentAt" = CURRENT_TIMESTAMP,
           "hourWindowStartedAt" = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE "hourWindowStartedAt" END,
           "sendsInHour" = CASE WHEN $4 THEN 1 ELSE "sendsInHour" + 1 END,
           "dayWindowStartedAt" = CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE "dayWindowStartedAt" END,
           "sendsInDay" = CASE WHEN $5 THEN 1 ELSE "sendsInDay" + 1 END,
           "failedAttempts" = 0, "consumedAt" = NULL, "createdAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP WHERE id = $6`,
          [tokenHash, createPasswordResetOtpDigest(user.id, tokenHash, placeholderCode), ttl, resetHour, resetDay, current.id],
        );
      }
      const reuseExistingToken = existingToken && hashToken(existingToken) === current.tokenHash;
      return {
        email: current.email,
        userId: user.id,
        code,
        token: reuseExistingToken && !current.consumedAt ? existingToken : token,
        cookieToken: reuseExistingToken && !current.consumedAt ? existingToken : fallbackToken,
        shouldSendEmail: true,
        commitOnAcceptance: true,
        challengeId: current.id,
      };
    }

    await query(
      `INSERT INTO password_reset_challenges
       (id, "userId", email, "isDecoy", "tokenHash", "codeHash", "expiresAt", "lastSentAt",
        "hourWindowStartedAt", "sendsInHour", "dayWindowStartedAt", "sendsInDay",
        "failedAttempts", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, false, $4, $5, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $6 MINUTE),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, 1, 0, CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP)`,
      [challengeId, user.id, user.email, tokenHash, createPasswordResetOtpDigest(user.id, tokenHash, placeholderCode), ttl],
    );
    return { email: user.email, userId: user.id, code, token, cookieToken: token, shouldSendEmail: true, commitOnAcceptance: true, challengeId };
  });
}

export async function commitPasswordResetCode(prepared: PreparedPasswordReset): Promise<void> {
  if (!prepared.commitOnAcceptance) return;
  if (!prepared.userId) throw new AuthError('The reset request is no longer available. Request a new code.', 400);
  const ttl = getEmailOtpTtlMinutes();
  const tokenHash = hashToken(prepared.token);
  await db.transaction(async ({ query }) => {
    const account = await query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND "emailVerified" = true
       AND "isActive" = true AND "archivedAt" IS NULL LIMIT 1 FOR UPDATE`,
      [prepared.userId],
    );
    if (!account.rows[0]) throw new AuthError('The reset request is no longer available. Request a new code.', 400);
    const result = await query<PasswordResetRow>(
      `SELECT * FROM password_reset_challenges
       WHERE id = $1 AND "userId" = $2 AND "consumedAt" IS NULL LIMIT 1 FOR UPDATE`,
      [prepared.challengeId, prepared.userId],
    );
    const row = result.rows[0];
    if (!row || row.isDecoy || !row.userId) {
      throw new AuthError('The reset request is no longer available. Request a new code.', 400);
    }
    await query(
      `UPDATE password_reset_challenges SET "tokenHash" = $1, "codeHash" = $2,
       "expiresAt" = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $3 MINUTE),
       "failedAttempts" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`,
      [tokenHash, createPasswordResetOtpDigest(row.userId, tokenHash, prepared.code), ttl, row.id],
    );
  });
}

async function recordFailedAttempt(
  query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }>,
  row: PasswordResetRow,
): Promise<{ message: string; statusCode: 400 | 429 }> {
  const failedAttempts = row.failedAttempts + 1;
  await query(
    `UPDATE password_reset_challenges SET "failedAttempts" = $1,
     "consumedAt" = CASE WHEN $1 >= $2 THEN CURRENT_TIMESTAMP ELSE "consumedAt" END,
     "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
    [failedAttempts, RESET_MAX_FAILED_ATTEMPTS, row.id],
  );
  return {
    message: 'The reset code is invalid or expired. Check it and try again.',
    statusCode: failedAttempts >= RESET_MAX_FAILED_ATTEMPTS ? 429 : 400,
  };
}

export async function completePasswordReset(
  email: string,
  token: string | undefined,
  code: string,
  newPassword: string,
): Promise<{ email: string; userId: string; fullName: string | null } | undefined> {
  if (!token) throw new AuthError(genericResetError, 400);
  const normalizedEmail = email.trim().toLowerCase();
  const tokenHash = hashToken(token);
  const outcome = await db.transaction<{
    result: { email: string; userId: string; fullName: string | null } | undefined;
    failure: { message: string; statusCode: 400 | 429 } | undefined;
  }>(async ({ query }) => {
    const preview = await loadChallengeForUpdate(query, tokenHash, false);
    if (!preview || preview.isDecoy || !preview.userId || preview.email.toLowerCase() !== normalizedEmail || preview.consumedAt) {
      return { result: undefined, failure: { message: genericResetError, statusCode: 400 } };
    }
    const account = await query<{ id: string; email: string; fullName: string | null }>(
      `SELECT id, email, "fullName" FROM users
       WHERE id = $1 AND email = $2 AND "emailVerified" = true AND "isActive" = true AND "archivedAt" IS NULL
       LIMIT 1 FOR UPDATE`,
      [preview.userId, normalizedEmail],
    );
    if (!account.rows[0]) {
      return { result: undefined, failure: { message: genericResetError, statusCode: 400 } };
    }
    const challengeResult = await query<PasswordResetRow>(
      `SELECT * FROM password_reset_challenges
       WHERE id = $1 AND "tokenHash" = $2 LIMIT 1 FOR UPDATE`,
      [preview.id, tokenHash],
    );
    const row = challengeResult.rows[0];
    if (!row || row.isDecoy || row.userId !== preview.userId || row.email.toLowerCase() !== normalizedEmail || row.consumedAt) {
      return { result: undefined, failure: { message: genericResetError, statusCode: 400 } };
    }
    const now = Date.now();
    const expiresAt = millis(row.expiresAt);
    if (expiresAt === null || expiresAt <= now) {
      return { result: undefined, failure: { message: genericResetError, statusCode: 400 } };
    }
    const candidate = createPasswordResetOtpDigest(row.userId, tokenHash, code);
    if (!compareDigest(row.codeHash, candidate)) {
      return { result: undefined, failure: await recordFailedAttempt(query, row) };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const updated = await query(
      `UPDATE users SET "passwordHash" = $1, "authVersion" = "authVersion" + 1,
       "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 AND "emailVerified" = true AND "isActive" = true`,
      [newHash, row.userId],
    );
    if (updated.rowCount !== 1) {
      return { result: undefined, failure: { message: genericResetError, statusCode: 400 } };
    }
    await query(
      `UPDATE password_reset_challenges SET "consumedAt" = CURRENT_TIMESTAMP,
       "codeHash" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $2 AND "consumedAt" IS NULL`,
      [createHash('sha256').update(randomBytes(32)).digest('hex'), row.userId],
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, 'PASSWORD_RESET', 'User', $2, 'Password reset completed; no credential or reset-code values were recorded.')`,
      [`audit-${randomBytes(16).toString('hex')}`, row.userId],
    );
    return {
      result: { email: account.rows[0].email, userId: row.userId, fullName: account.rows[0].fullName },
      failure: undefined,
    };
  });
  if (outcome.failure) throw new AuthError(outcome.failure.message, outcome.failure.statusCode);
  return outcome.result;
}
