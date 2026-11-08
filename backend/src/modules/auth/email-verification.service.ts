import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import { AuthError } from './auth.errors';
import { getEmailOtpTtlMinutes } from './auth.email-verification.config';
import { generateToken } from './auth.tokens';
import type { AuthRole } from './auth.types';

const RESEND_COOLDOWN_MS = 60_000;
const SEND_HOUR_LIMIT = 5;
const SEND_DAY_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_FAILED_ATTEMPTS = 5;

interface VerificationRow {
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
  attemptWindowStartedAt: Date | string;
  lockedUntil: Date | string | null;
  verifiedAt: Date | string | null;
  fullName: string | null;
  role: AuthRole | null;
  isActive: boolean | null;
  emailVerified: boolean | null;
}

const toMillis = (value: Date | string | null): number | null => {
  if (value === null) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

function hashRegistrationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createBoundEmailOtpDigest(userId: string, tokenBinding: string, code: string): string {
  const secret = process.env.EMAIL_OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new AuthError('Email verification is not configured. Set EMAIL_OTP_SECRET to a random secret of at least 32 characters.', 503);
  }
  return createHmac('sha256', secret).update(`${userId}:${tokenBinding}:${code}`).digest('hex');
}

export function createEmailOtpDigest(userId: string, token: string, code: string): string {
  return createBoundEmailOtpDigest(userId, token, code);
}

export function createEmailOtpDigestForTokenHash(userId: string, tokenHash: string, code: string): string {
  return createBoundEmailOtpDigest(userId, tokenHash, code);
}

export function compareEmailOtpDigests(storedDigest: string, candidateDigest: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(storedDigest) || !/^[a-f0-9]{64}$/i.test(candidateDigest)) return false;
  return timingSafeEqual(Buffer.from(storedDigest, 'hex'), Buffer.from(candidateDigest, 'hex'));
}

export function maskEmailAddress(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'your email address';
  const visible = localPart.length > 2 ? `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 2, 6))}${localPart.at(-1)}` : `${localPart[0]}*`;
  return `${visible}@${domain}`;
}

export function generateEmailOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function loadChallengeForUpdate(query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }>, tokenHash: string) {
  const result = await query<VerificationRow>(
    `SELECT v.*, COALESCE(u.email, v.email) AS email, u."fullName", u.role, u."isActive", u."emailVerified"
     FROM email_verification_challenges v
     LEFT JOIN users u ON u.id = v."userId"
     WHERE v."tokenHash" = $1
     LIMIT 1 FOR UPDATE`,
    [tokenHash]
  );
  return result.rows[0];
}

function assertUsableRegistration(row: VerificationRow | undefined): asserts row is VerificationRow {
  if (!row || row.verifiedAt || (!row.isDecoy && (row.emailVerified || row.isActive))) {
    throw new AuthError('This verification session is no longer available. Sign in or start registration again.', 401);
  }
}

function checkSendLimits(row: Pick<VerificationRow, 'lastSentAt' | 'hourWindowStartedAt' | 'sendsInHour' | 'dayWindowStartedAt' | 'sendsInDay'>, now: number) {
  const lastSent = toMillis(row.lastSentAt) ?? 0;
  if (now - lastSent < RESEND_COOLDOWN_MS) {
    throw new AuthError('Please wait before requesting another verification code.', 429);
  }
  const hourStart = toMillis(row.hourWindowStartedAt) ?? now;
  const dayStart = toMillis(row.dayWindowStartedAt) ?? now;
  if (now - hourStart < 60 * 60_000 && row.sendsInHour >= SEND_HOUR_LIMIT) {
    throw new AuthError('You have reached the hourly verification email limit. Try again later.', 429);
  }
  if (now - dayStart < 24 * 60 * 60_000 && row.sendsInDay >= SEND_DAY_LIMIT) {
    throw new AuthError('You have reached the daily verification email limit. Try again tomorrow.', 429);
  }
}

export async function createEmailVerificationChallenge(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const code = generateEmailOtpCode();
  const tokenHash = hashRegistrationToken(token);
  const codeHash = createEmailOtpDigestForTokenHash(userId, tokenHash, code);
  const ttlMinutes = getEmailOtpTtlMinutes();
  const now = Date.now();
  const challengeId = `ev-${randomBytes(16).toString('hex')}`;
  let requiresCommit = false;

  await db.transaction(async ({ query }) => {
    await query('DELETE FROM email_verification_challenges WHERE "expiresAt" < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
    const existingResult = await query<VerificationRow>(
      `SELECT v.*, u.email, u."fullName", u.role, u."isActive", u."emailVerified"
       FROM email_verification_challenges v JOIN users u ON u.id = v."userId"
       WHERE v."userId" = $1 LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const existing = existingResult.rows[0];
    if (existing) {
      checkSendLimits(existing, now);
      const hourStart = toMillis(existing.hourWindowStartedAt) ?? now;
      const dayStart = toMillis(existing.dayWindowStartedAt) ?? now;
      const resetHour = now - hourStart >= 60 * 60_000;
      const resetDay = now - dayStart >= 24 * 60 * 60_000;
      await query(
        `UPDATE email_verification_challenges SET "lastSentAt" = CURRENT_TIMESTAMP,
         "hourWindowStartedAt" = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE "hourWindowStartedAt" END,
         "sendsInHour" = CASE WHEN $1 THEN 1 ELSE "sendsInHour" + 1 END,
         "dayWindowStartedAt" = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE "dayWindowStartedAt" END,
         "sendsInDay" = CASE WHEN $2 THEN 1 ELSE "sendsInDay" + 1 END,
         "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
        [resetHour, resetDay, existing.id]
      );
      requiresCommit = true;
      return;
    }

    await query(
      `INSERT INTO email_verification_challenges
       (id, "userId", email, "isDecoy", "tokenHash", "codeHash", "expiresAt", "lastSentAt", "hourWindowStartedAt", "sendsInHour",
        "dayWindowStartedAt", "sendsInDay", "failedAttempts", "attemptWindowStartedAt", "createdAt", "updatedAt")
       SELECT $1, $2, u.email, false, $3, $4, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $5 MINUTE), CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       FROM users u WHERE u.id = $2`,
      [challengeId, userId, tokenHash, codeHash, ttlMinutes]
    );
  });

  return { token, code, requiresCommit, expiresAt: new Date(now + ttlMinutes * 60_000).toISOString() };
}

export async function commitEmailVerificationChallenge(userId: string, token: string, code: string): Promise<void> {
  const tokenHash = hashRegistrationToken(token);
  const ttlMinutes = getEmailOtpTtlMinutes();
  await db.transaction(async ({ query }) => {
    const result = await query<VerificationRow>(
      `SELECT v.*, COALESCE(u.email, v.email) AS email, u."fullName", u.role, u."isActive", u."emailVerified"
       FROM email_verification_challenges v LEFT JOIN users u ON u.id = v."userId"
       WHERE v."userId" = $1 LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const row = result.rows[0];
    assertUsableRegistration(row);
    await query(
      `UPDATE email_verification_challenges SET "tokenHash" = $1, "codeHash" = $2,
       "expiresAt" = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $3 MINUTE),
       "failedAttempts" = 0, "attemptWindowStartedAt" = CURRENT_TIMESTAMP,
       "lockedUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`,
      [tokenHash, createEmailOtpDigestForTokenHash(userId, tokenHash, code), ttlMinutes, row.id],
    );
  });
}

export async function createEmailVerificationDecoy(email: string) {
  const token = randomBytes(32).toString('base64url');
  const code = generateEmailOtpCode();
  const tokenHash = hashRegistrationToken(token);
  const codeHash = createEmailOtpDigestForTokenHash('decoy', tokenHash, code);
  const challengeId = `ev-${randomBytes(16).toString('hex')}`;
  const ttlMinutes = getEmailOtpTtlMinutes();

  await db.transaction(async ({ query }) => {
    await query('DELETE FROM email_verification_challenges WHERE "expiresAt" < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
    await query(
      `INSERT INTO email_verification_challenges
       (id, "userId", email, "isDecoy", "tokenHash", "codeHash", "expiresAt", "lastSentAt",
        "hourWindowStartedAt", "sendsInHour", "dayWindowStartedAt", "sendsInDay",
        "failedAttempts", "attemptWindowStartedAt", "createdAt", "updatedAt")
       VALUES ($1, NULL, $2, true, $3, $4, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $5 MINUTE),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, 1, 0, CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [challengeId, email, tokenHash, codeHash, ttlMinutes]
    );
  });

  return { token, code };
}

export async function getEmailVerificationStatus(token: string | undefined) {
  if (!token) throw new AuthError('Verification session is unavailable. Register or sign in to continue.', 401);
  const result = await db.query<VerificationRow>(
    `SELECT v.*, COALESCE(u.email, v.email) AS email, u."fullName", u.role, u."isActive", u."emailVerified"
     FROM email_verification_challenges v LEFT JOIN users u ON u.id = v."userId"
     WHERE v."tokenHash" = $1 LIMIT 1`,
    [hashRegistrationToken(token)]
  );
  const row = result.rows[0];
  assertUsableRegistration(row);
  return {
    email: maskEmailAddress(row.email),
    expiresAt: new Date(row.expiresAt).toISOString(),
    resendAvailableAt: new Date((toMillis(row.lastSentAt) ?? Date.now()) + RESEND_COOLDOWN_MS).toISOString()
  };
}

export async function resendEmailVerificationCode(token: string | undefined) {
  if (!token) throw new AuthError('Verification session is unavailable. Register again to continue.', 401);
  const registrationToken = token;
  const tokenHash = hashRegistrationToken(registrationToken);
  const now = Date.now();
  const code = generateEmailOtpCode();
  let recipient = '';
  let shouldSendEmail = false;
  const ttlMinutes = getEmailOtpTtlMinutes();

  await db.transaction(async ({ query }) => {
    const row = await loadChallengeForUpdate(query, tokenHash);
    assertUsableRegistration(row);
    checkSendLimits(row, now);

    const hourStart = toMillis(row.hourWindowStartedAt) ?? now;
    const dayStart = toMillis(row.dayWindowStartedAt) ?? now;
    const attemptWindowStart = toMillis(row.attemptWindowStartedAt) ?? now;
    const resetHour = now - hourStart >= 60 * 60_000;
    const resetDay = now - dayStart >= 24 * 60 * 60_000;
    const resetAttempts = now - attemptWindowStart >= ATTEMPT_WINDOW_MS;
    await query(
      `UPDATE email_verification_challenges SET "lastSentAt" = CURRENT_TIMESTAMP,
       "hourWindowStartedAt" = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE "hourWindowStartedAt" END,
       "sendsInHour" = CASE WHEN $1 THEN 1 ELSE "sendsInHour" + 1 END,
       "dayWindowStartedAt" = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE "dayWindowStartedAt" END,
       "sendsInDay" = CASE WHEN $2 THEN 1 ELSE "sendsInDay" + 1 END,
       "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
      [resetHour, resetDay, row.id]
    );
    recipient = row.email;
    shouldSendEmail = !row.isDecoy;
  });

  return { email: recipient, code, shouldSendEmail, expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString() };
}

export async function commitEmailVerificationResend(token: string | undefined, code: string): Promise<void> {
  if (!token) throw new AuthError('Verification session is unavailable. Register again to continue.', 401);
  const tokenHash = hashRegistrationToken(token);
  const ttlMinutes = getEmailOtpTtlMinutes();
  await db.transaction(async ({ query }) => {
    const row = await loadChallengeForUpdate(query, tokenHash);
    assertUsableRegistration(row);
    if (row.isDecoy || !row.userId) return;
    await query(
      `UPDATE email_verification_challenges SET "codeHash" = $1,
       "expiresAt" = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $2 MINUTE),
       "failedAttempts" = 0, "attemptWindowStartedAt" = CURRENT_TIMESTAMP,
       "lockedUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
      [createEmailOtpDigestForTokenHash(row.userId, tokenHash, code), ttlMinutes, row.id],
    );
  });
}

export async function prepareAdminEmailVerificationResend(userId: string) {
  const code = generateEmailOtpCode();
  const ttlMinutes = getEmailOtpTtlMinutes();
  let recipient = '';

  await db.transaction(async ({ query }) => {
    const result = await query<VerificationRow>(
      `SELECT v.*, u.email, u."fullName", u.role, u."isActive", u."emailVerified"
       FROM email_verification_challenges v
       JOIN users u ON u.id = v."userId"
       WHERE v."userId" = $1 AND u."archivedAt" IS NULL AND u.role IN ('JOB_SEEKER', 'EMPLOYER', 'ADMIN')
       LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) throw new AuthError('No active verification request exists. Ask the account holder to request a code from the sign-in page first.', 409);
    assertUsableRegistration(row);

    const now = Date.now();
    const lockedUntil = toMillis(row.lockedUntil);
    if (lockedUntil !== null && lockedUntil > now) {
      throw new AuthError('This verification request is temporarily locked. Try again after the lock expires.', 429);
    }
    checkSendLimits(row, now);

    const hourStart = toMillis(row.hourWindowStartedAt) ?? now;
    const dayStart = toMillis(row.dayWindowStartedAt) ?? now;
    const attemptWindowStart = toMillis(row.attemptWindowStartedAt) ?? now;
    const resetHour = now - hourStart >= 60 * 60_000;
    const resetDay = now - dayStart >= 24 * 60 * 60_000;
    const resetAttempts = now - attemptWindowStart >= ATTEMPT_WINDOW_MS;

    await query(
      `UPDATE email_verification_challenges SET "lastSentAt" = CURRENT_TIMESTAMP,
       "hourWindowStartedAt" = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE "hourWindowStartedAt" END,
       "sendsInHour" = CASE WHEN $1 THEN 1 ELSE "sendsInHour" + 1 END,
       "dayWindowStartedAt" = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE "dayWindowStartedAt" END,
       "sendsInDay" = CASE WHEN $2 THEN 1 ELSE "sendsInDay" + 1 END,
       "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
      [resetHour, resetDay, row.id],
    );
    recipient = row.email;
  });

  return { email: recipient, code, expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString() };
}

export async function commitAdminEmailVerificationResend(userId: string, code: string): Promise<void> {
  const ttlMinutes = getEmailOtpTtlMinutes();
  await db.transaction(async ({ query }) => {
    const result = await query<VerificationRow>(
      `SELECT v.*, u.email, u."fullName", u.role, u."isActive", u."emailVerified"
       FROM email_verification_challenges v JOIN users u ON u.id = v."userId"
       WHERE v."userId" = $1 AND u."archivedAt" IS NULL AND u.role IN ('JOB_SEEKER', 'EMPLOYER', 'ADMIN')
       LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const row = result.rows[0];
    assertUsableRegistration(row);
    if (!row.userId) throw new AuthError('No pending verification request exists for this account.', 409);
    await query(
      `UPDATE email_verification_challenges SET "codeHash" = $1,
       "expiresAt" = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $2 MINUTE),
       "failedAttempts" = 0, "attemptWindowStartedAt" = CURRENT_TIMESTAMP,
       "lockedUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`,
      [createEmailOtpDigestForTokenHash(userId, row.tokenHash, code), ttlMinutes, row.id],
    );
  });
}

export async function verifyEmailVerificationCode(token: string | undefined, code: string) {
  if (!token) throw new AuthError('Verification session is unavailable. Register again to continue.', 401);
  const registrationToken = token;
  const tokenHash = hashRegistrationToken(registrationToken);
  const result = await db.transaction(async ({ query }) => {
    const row = await loadChallengeForUpdate(query, tokenHash);
    assertUsableRegistration(row);
    const now = Date.now();
    const lockUntil = toMillis(row.lockedUntil);
    if (lockUntil !== null && lockUntil > now) {
      throw new AuthError('Too many incorrect codes. Please wait before trying again.', 429);
    }

    const expiresAt = toMillis(row.expiresAt);
    if (expiresAt === null || expiresAt <= now) {
      throw new AuthError('This verification code has expired. Request a new code to continue.', 410);
    }

    const attemptWindowStartedAt = toMillis(row.attemptWindowStartedAt) ?? now;
    const attempts = now - attemptWindowStartedAt >= ATTEMPT_WINDOW_MS ? 0 : row.failedAttempts;
    if (row.isDecoy || !row.userId) {
      const nextAttempts = attempts + 1;
      await query(
        `UPDATE email_verification_challenges SET "failedAttempts" = $1,
         "attemptWindowStartedAt" = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE "attemptWindowStartedAt" END,
         "lockedUntil" = CASE WHEN $1 >= $3 THEN DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) ELSE "lockedUntil" END,
         "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`,
        [nextAttempts, attempts === 0, MAX_FAILED_ATTEMPTS, row.id]
      );
      return {
        ok: false as const,
        message: 'That code is incorrect or unavailable. Check it and try again.',
        statusCode: nextAttempts >= MAX_FAILED_ATTEMPTS ? 429 as const : 400 as const
      };
    }

    const legacyDigest = createEmailOtpDigest(row.userId, registrationToken, code);
    const tokenHashDigest = createEmailOtpDigestForTokenHash(row.userId, tokenHash, code);
    const matches = compareEmailOtpDigests(row.codeHash, legacyDigest)
      || compareEmailOtpDigests(row.codeHash, tokenHashDigest);
    if (!matches) {
      const nextAttempts = attempts + 1;
      await query(
        `UPDATE email_verification_challenges SET "failedAttempts" = $1,
         "attemptWindowStartedAt" = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE "attemptWindowStartedAt" END,
         "lockedUntil" = CASE WHEN $1 >= $3 THEN DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) ELSE "lockedUntil" END,
         "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`,
        [nextAttempts, attempts === 0, MAX_FAILED_ATTEMPTS, row.id]
      );
      return {
        ok: false as const,
        message: nextAttempts >= MAX_FAILED_ATTEMPTS
          ? 'Too many incorrect codes. Please wait before trying again.'
          : 'That code is incorrect. Check it and try again.',
        statusCode: nextAttempts >= MAX_FAILED_ATTEMPTS ? 429 as const : 400 as const
      };
    }

    const activated = await query(
      `UPDATE users SET "emailVerified" = true, "isActive" = true,
       "emailVerificationMethod" = 'email_otp', "emailVerifiedAt" = CURRENT_TIMESTAMP,
       "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1 AND "emailVerified" = false AND "isActive" = false`,
      [row.userId]
    );
    if (activated.rowCount !== 1) {
      throw new AuthError('This verification session is no longer available. Sign in to continue.', 409);
    }
    await query(
      `UPDATE email_verification_challenges SET "verifiedAt" = CURRENT_TIMESTAMP,
       "codeHash" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
      [createHash('sha256').update(randomBytes(32)).digest('hex'), row.id]
    );
    return {
      ok: true as const,
      user: {
        userId: row.userId,
        email: row.email,
        fullName: row.fullName || '',
        role: row.role as AuthRole,
        emailVerified: true as const,
      }
    };
  });

  if (!result.ok) throw new AuthError(result.message, result.statusCode);
  const user = result.user;
  const tokenForSession = generateToken({
    userId: user.userId,
    email: user.email,
    role: user.role,
    fullName: user.fullName
  });
  return {
    token: tokenForSession,
    user: {
      id: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
    }
  };
}

export async function cleanExpiredEmailVerificationChallenges(): Promise<void> {
  await db.query('DELETE FROM email_verification_challenges WHERE "expiresAt" < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
}
