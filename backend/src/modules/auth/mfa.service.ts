import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../../infrastructure/database/drizzle';
import { getPasswordHash } from './auth.repository';
import { AuthError } from './auth.errors';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const CHALLENGE_MINUTES = 5;

function encryptionKey(): Buffer {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured as a separate random secret of at least 32 characters.');
  }
  return createHash('sha256').update(configured, 'utf8').digest();
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string): Buffer {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of value.replace(/=+$/u, '').toUpperCase()) {
    const digit = BASE32.indexOf(character);
    if (digit < 0) throw new Error('Invalid stored authenticator secret.');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    secretCiphertext: ciphertext.toString('base64'),
    secretIv: iv.toString('hex'),
    secretTag: cipher.getAuthTag().toString('hex'),
  };
}

function decryptSecret(row: { secretCiphertext: string; secretIv: string; secretTag: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.secretIv, 'hex'));
  decipher.setAuthTag(Buffer.from(row.secretTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.secretCiphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function totpAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function generateTotpCode(secretBase32: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
  return totpAtStep(secretBase32, Math.floor(timestampSeconds / STEP_SECONDS));
}

function matchingTotpStep(secret: string, code: string, lastStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpAtStep(secret, step));
    const actual = Buffer.from(code);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return step;
  }
  return null;
}

function recoveryHash(code: string): string {
  return createHash('sha256').update(code.toUpperCase().replace(/\s+/gu, ''), 'utf8').digest('hex');
}

async function assertCurrentPassword(userId: string, password: string) {
  const hash = await getPasswordHash(userId);
  if (!hash || !(await bcrypt.compare(password, hash))) {
    throw new AuthError('Current password is incorrect.', 401);
  }
}

export async function getAuthenticatorMfaStatus(userId: string) {
  const factor = await db.query<{ enabledAt: Date | string | null }>(
    'SELECT enabledAt FROM user_mfa_factors WHERE userId = $1 LIMIT 1',
    [userId],
  );
  const enabledAt = factor.rows[0]?.enabledAt ?? null;
  const recovery = enabledAt
    ? await db.query<{ count: number | string }>(
      'SELECT COUNT(*) AS count FROM user_mfa_recovery_codes WHERE userId = $1 AND usedAt IS NULL',
      [userId],
    )
    : null;
  return {
    totpEnabled: Boolean(enabledAt),
    enabledAt: enabledAt ? (enabledAt instanceof Date ? enabledAt : new Date(enabledAt)).toISOString() : null,
    recoveryCodesRemaining: Number(recovery?.rows[0]?.count ?? 0),
  };
}

export async function beginAuthenticatorEnrollment(userId: string, email: string, currentPassword: string) {
  await assertCurrentPassword(userId, currentPassword);
  const existing = await db.query<{ enabledAt: Date | string | null }>(
    'SELECT enabledAt FROM user_mfa_factors WHERE userId = $1 LIMIT 1',
    [userId],
  );
  if (existing.rows[0]?.enabledAt) throw new AuthError('Authenticator MFA is already enabled. Disable it before enrolling a new authenticator.', 409);

  const secret = encodeBase32(randomBytes(20));
  const encrypted = encryptSecret(secret);
  await db.query(
    `INSERT INTO user_mfa_factors (userId, secretCiphertext, secretIv, secretTag, lastTotpStep, enabledAt, createdAt, updatedAt)
     VALUES ($1, $2, $3, $4, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE secretCiphertext = VALUES(secretCiphertext), secretIv = VALUES(secretIv),
       secretTag = VALUES(secretTag), lastTotpStep = NULL, enabledAt = NULL, updatedAt = CURRENT_TIMESTAMP`,
    [userId, encrypted.secretCiphertext, encrypted.secretIv, encrypted.secretTag],
  );
  const label = `SKILLBRIDGE ET:${email}`;
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=SKILLBRIDGE%20ET&algorithm=SHA1&digits=6&period=30`;
  return { secret, otpauthUrl, issuer: 'SKILLBRIDGE ET', account: email };
}

export async function confirmAuthenticatorEnrollment(userId: string, code: string) {
  return db.transaction(async ({ query }) => {
    const selected = await query<{ secretCiphertext: string; secretIv: string; secretTag: string; enabledAt: Date | string | null; lastTotpStep: number | string | null }>(
      'SELECT secretCiphertext, secretIv, secretTag, enabledAt, lastTotpStep FROM user_mfa_factors WHERE userId = $1 FOR UPDATE',
      [userId],
    );
    const factor = selected.rows[0];
    if (!factor || factor.enabledAt) throw new AuthError('Start a new authenticator enrollment before confirming.', 409);
    const secret = decryptSecret(factor);
    const step = matchingTotpStep(secret, code, factor.lastTotpStep === null ? null : Number(factor.lastTotpStep));
    if (step === null) throw new AuthError('The authenticator code is invalid or expired. Check your device time and try again.', 400);

    await query('UPDATE user_mfa_factors SET enabledAt = CURRENT_TIMESTAMP, lastTotpStep = $1, updatedAt = CURRENT_TIMESTAMP WHERE userId = $2', [step, userId]);
    await query('DELETE FROM user_mfa_recovery_codes WHERE userId = $1', [userId]);
    const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(10).toString('hex').toUpperCase());
    for (const recoveryCode of recoveryCodes) {
      await query(
        'INSERT INTO user_mfa_recovery_codes (id, userId, codeHash, usedAt, createdAt) VALUES ($1, $2, $3, NULL, CURRENT_TIMESTAMP)',
        [`mfacode-${randomUUID()}`, userId, recoveryHash(recoveryCode)],
      );
    }
    await query(
      `INSERT INTO platform_audit_logs (id, userId, action, entityType, entityId, details)
       VALUES ($1, $2, 'MFA_TOTP_ENABLED', 'User', $3, 'Authenticator-based multi-factor authentication enabled.')`,
      [`audit-${randomUUID()}`, userId, userId],
    );
    return { enabled: true, recoveryCodes };
  });
}

export async function disableAuthenticatorMfa(userId: string, currentPassword: string, code: string) {
  await assertCurrentPassword(userId, currentPassword);
  return db.transaction(async ({ query }) => {
    const selected = await query<{ secretCiphertext: string; secretIv: string; secretTag: string; enabledAt: Date | string | null; lastTotpStep: number | string | null }>(
      'SELECT secretCiphertext, secretIv, secretTag, enabledAt, lastTotpStep FROM user_mfa_factors WHERE userId = $1 FOR UPDATE',
      [userId],
    );
    const factor = selected.rows[0];
    if (!factor?.enabledAt) throw new AuthError('Authenticator MFA is not enabled.', 409);
    const step = matchingTotpStep(decryptSecret(factor), code, factor.lastTotpStep === null ? null : Number(factor.lastTotpStep));
    if (step === null) throw new AuthError('The authenticator code is invalid or has already been used.', 401);
    await query('DELETE FROM user_mfa_recovery_codes WHERE userId = $1', [userId]);
    await query('DELETE FROM user_mfa_factors WHERE userId = $1', [userId]);
    await query(
      `INSERT INTO platform_audit_logs (id, userId, action, entityType, entityId, details)
       VALUES ($1, $2, 'MFA_TOTP_DISABLED', 'User', $3, 'Authenticator-based multi-factor authentication disabled after password and TOTP verification.')`,
      [`audit-${randomUUID()}`, userId, userId],
    );
    return { disabled: true };
  });
}

export async function createLoginMfaChallenge(userId: string): Promise<string> {
  const id = randomUUID();
  await db.query('DELETE FROM auth_mfa_challenges WHERE expiresAt < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
  await db.query(
    'INSERT INTO auth_mfa_challenges (id, userId, expiresAt, attempts, usedAt, createdAt) VALUES ($1, $2, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE), 0, NULL, CURRENT_TIMESTAMP)',
    [id, userId],
  );
  return id;
}

export async function verifyLoginMfaChallenge(challengeId: string, code: string) {
  const attempt = await db.query(
    'UPDATE auth_mfa_challenges SET attempts = attempts + 1 WHERE id = $1 AND usedAt IS NULL AND expiresAt > CURRENT_TIMESTAMP AND attempts < 5',
    [challengeId],
  );
  if (attempt.rowCount !== 1) throw new AuthError('This sign-in challenge has expired, was already used, or reached its attempt limit. Sign in again.', 401);
  return db.transaction(async ({ query }) => {
    const challengeResult = await query<{ userId: string }>(
      'SELECT userId FROM auth_mfa_challenges WHERE id = $1 AND usedAt IS NULL AND expiresAt > CURRENT_TIMESTAMP FOR UPDATE',
      [challengeId],
    );
    const challenge = challengeResult.rows[0];
    if (!challenge) throw new AuthError('This sign-in challenge has expired or was already used. Sign in again.', 401);

    const factorResult = await query<{ secretCiphertext: string; secretIv: string; secretTag: string; enabledAt: Date | string | null; lastTotpStep: number | string | null }>(
      'SELECT secretCiphertext, secretIv, secretTag, enabledAt, lastTotpStep FROM user_mfa_factors WHERE userId = $1 FOR UPDATE',
      [challenge.userId],
    );
    const factor = factorResult.rows[0];
    if (!factor?.enabledAt) throw new AuthError('Authenticator MFA is no longer enabled. Sign in again.', 401);

    const step = matchingTotpStep(decryptSecret(factor), code, factor.lastTotpStep === null ? null : Number(factor.lastTotpStep));
    let recoveryUsed = false;
    if (step !== null) {
      await query('UPDATE user_mfa_factors SET lastTotpStep = $1, updatedAt = CURRENT_TIMESTAMP WHERE userId = $2', [step, challenge.userId]);
    } else {
      const recovery = await query<{ id: string }>(
        'SELECT id FROM user_mfa_recovery_codes WHERE userId = $1 AND codeHash = $2 AND usedAt IS NULL LIMIT 1 FOR UPDATE',
        [challenge.userId, recoveryHash(code)],
      );
      if (!recovery.rows[0]) throw new AuthError('The authenticator or recovery code is invalid.', 401);
      await query('UPDATE user_mfa_recovery_codes SET usedAt = CURRENT_TIMESTAMP WHERE id = $1 AND usedAt IS NULL', [recovery.rows[0].id]);
      recoveryUsed = true;
    }

    const consumed = await query(
      'UPDATE auth_mfa_challenges SET usedAt = CURRENT_TIMESTAMP WHERE id = $1 AND usedAt IS NULL AND expiresAt > CURRENT_TIMESTAMP',
      [challengeId],
    );
    if (consumed.rowCount !== 1) throw new AuthError('This sign-in challenge has already been used. Sign in again.', 409);

    const userResult = await query<{
      id: string; email: string; fullName: string; role: 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
      isActive: boolean; emailVerified: boolean; authVersion: number;
    }>(
      'SELECT id, email, fullName, role, isActive, emailVerified, authVersion FROM users WHERE id = $1 AND isActive = true AND emailVerified = true AND archivedAt IS NULL LIMIT 1',
      [challenge.userId],
    );
    const user = userResult.rows[0];
    if (!user) throw new AuthError('This account is no longer eligible to sign in.', 403);
    await query(
      `INSERT INTO platform_audit_logs (id, userId, action, entityType, entityId, details)
       VALUES ($1, $2, 'MFA_LOGIN_VERIFIED', 'User', $3, $4)`,
      [`audit-${randomUUID()}`, user.id, user.id, recoveryUsed ? 'Sign-in completed using a one-time recovery code.' : 'Sign-in completed using TOTP.'],
    );
    return user;
  });
}
