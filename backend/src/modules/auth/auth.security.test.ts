import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { requireRole } from '../../middleware/auth';
import { assertCanDeleteAdminAccount } from './auth.policy';
import { changePasswordSchema, loginSchema, registerSchema, requestEmailVerificationSchema, verifyEmailCodeSchema } from './auth.schemas';
import { generateToken, verifyToken } from './auth.tokens';
import { register, requestRegistrationEmailVerification, resolveAuthenticatedUser, verifyLoginCredentials } from './auth.service';
import type { AuthDatabaseUser, AuthRole } from './auth.types';
import { AuthError } from './auth.errors';
import { generateTotpCode } from './mfa.service';
import {
  assertEmailDeliveryConfigured,
  getEmailVerificationUrl,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './auth.email';
import { db } from '../../infrastructure/database/drizzle';
import {
  prepareAdminEmailVerificationResend,
  commitEmailVerificationResend,
  compareEmailOtpDigests,
  createEmailOtpDigest,
  createEmailOtpDigestForTokenHash,
  generateEmailOtpCode,
  maskEmailAddress,
  resendEmailVerificationCode,
  verifyEmailVerificationCode,
} from './email-verification.service';
import { getEmailOtpTtlMinutes } from './auth.email-verification.config';
import { forgotPasswordSchema, passwordResetSchema } from './auth.schemas';
import {
  commitPasswordResetCode,
  completePasswordReset,
  createPasswordResetOtpDigest,
  preparePasswordReset,
} from './password-reset.service';

process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-at-least-32-characters';
process.env.EMAIL_OTP_SECRET ??= 'test-only-email-otp-secret-of-32-characters-minimum';

type MockDatabaseResult = { rows: unknown[]; rowCount: number };
type MockDatabaseHandler = (statement: string, params: unknown[]) => Promise<MockDatabaseResult>;

function mockDatabase(handler: MockDatabaseHandler, serializeTransactions = false): () => void {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  let transactionTail = Promise.resolve();
  const query: typeof db.query = async <T = any>(statement: string, params: unknown[] = []) => {
    const result = await handler(statement, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  };
  const transaction: typeof db.transaction = async <T>(callback: (transaction: { query: typeof query }) => Promise<T>) => {
    if (!serializeTransactions) return callback({ query });
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback({ query });
    } finally {
      release();
    }
  };

  db.query = query;
  db.transaction = transaction;
  return () => {
    db.query = originalQuery;
    db.transaction = originalTransaction;
  };
}

function createPasswordResetFixture(overrides: Record<string, unknown> = {}) {
  const userId = 'reset-user-1';
  const token = 'password-reset-test-token';
  const code = '593027';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const row: {
    id: string;
    userId: string;
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
    fullName: string;
    [key: string]: unknown;
  } = {
    id: 'reset-challenge-1',
    userId,
    email: 'person@example.test',
    isDecoy: false,
    tokenHash,
    codeHash: createPasswordResetOtpDigest(userId, tokenHash, code),
    expiresAt: new Date(now + 10 * 60_000),
    lastSentAt: new Date(now - 2 * 60_000),
    hourWindowStartedAt: new Date(now - 10 * 60_000),
    sendsInHour: 1,
    dayWindowStartedAt: new Date(now - 10 * 60_000),
    sendsInDay: 1,
    failedAttempts: 0,
    consumedAt: null,
    createdAt: new Date(now - 2 * 60_000),
    fullName: 'Test User',
    ...overrides,
  };
  return {
    token,
    code,
    row,
  };
}

function createVerificationFixture(overrides: Record<string, unknown> = {}) {
  const userId = 'verify-user-1';
  const token = 'test-registration-token';
  const code = '004281';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  return {
    token,
    code,
    row: {
      id: 'challenge-1',
      userId,
      email: 'person@example.test',
      isDecoy: false,
      tokenHash,
      codeHash: createEmailOtpDigest(userId, token, code),
      expiresAt: new Date(now + 10 * 60_000),
      lastSentAt: new Date(now - 2 * 60_000),
      hourWindowStartedAt: new Date(now - 10 * 60_000),
      sendsInHour: 1,
      dayWindowStartedAt: new Date(now - 10 * 60_000),
      sendsInDay: 1,
      failedAttempts: 0,
      attemptWindowStartedAt: new Date(now - 10 * 60_000),
      lockedUntil: null,
      verifiedAt: null,
      fullName: 'Test User',
      role: 'JOB_SEEKER',
      isActive: false,
      emailVerified: false,
      ...overrides,
    },
  };
}

test('TOTP generation follows the RFC 6238 SHA-1 test vector', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(generateTotpCode(secret, 59), '287082');
  assert.equal(generateTotpCode(secret, 1111111109), '081804');
});

test('public registration accepts only job seeker and employer roles', () => {
  const base = { email: 'admin@example.test', password: 'a-strong-test-password', fullName: 'Test User' };
  assert.equal(registerSchema.safeParse({ ...base, role: 'JOB_SEEKER' }).success, true);
  assert.equal(registerSchema.safeParse({ ...base, role: 'EMPLOYER' }).success, true);
  assert.equal(registerSchema.safeParse({ ...base, role: 'ADMIN' }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, email: `${'a'.repeat(180)}@example.test`, role: 'JOB_SEEKER' }).success, false);
  assert.equal(verifyEmailCodeSchema.safeParse({ code: '004281' }).success, true);
  assert.equal(verifyEmailCodeSchema.safeParse({ code: '4281' }).success, false);
});

test('password recovery validates email, six-digit OTP, and matching strong passwords', () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: 'person@example.test' }).success, true);
  assert.equal(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success, false);
  const valid = {
    email: 'person@example.test',
    code: '004281',
    newPassword: 'a-very-strong-reset-password',
    confirmPassword: 'a-very-strong-reset-password',
  };
  assert.equal(passwordResetSchema.safeParse(valid).success, true);
  assert.equal(passwordResetSchema.safeParse({ ...valid, code: '4281' }).success, false);
  assert.equal(passwordResetSchema.safeParse({ ...valid, confirmPassword: 'another-strong-password' }).success, false);
  assert.equal(passwordResetSchema.safeParse({ ...valid, newPassword: 'short', confirmPassword: 'short' }).success, false);
});

test('login accepts the configured administrator identifier', () => {
  assert.equal(loginSchema.safeParse({ email: 'admin@skillbridge.ss', password: 'a-password' }).success, true);
});

test('password change requires a strong matching new password', () => {
  const base = { currentPassword: 'current-password', newPassword: 'a-strong-new-password', confirmPassword: 'a-strong-new-password' };
  assert.equal(changePasswordSchema.safeParse(base).success, true);
  assert.equal(changePasswordSchema.safeParse({ ...base, newPassword: 'short', confirmPassword: 'short' }).success, false);
  assert.equal(changePasswordSchema.safeParse({ ...base, confirmPassword: 'different-new-password' }).success, false);
  assert.equal(changePasswordSchema.safeParse({ ...base, newPassword: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }).success, false);
});

test('unknown, inactive, and wrong-password credentials all fail generically', async () => {
  const passwordHash = await bcrypt.hash('correct-test-password', 4);
  const user: AuthDatabaseUser = {
    id: 'user-1',
    email: 'admin@admin.skillbridge.local',
    passwordHash,
    fullName: 'Test Admin',
    role: 'ADMIN',
    isActive: true,
    emailVerified: true
  };
  const inactiveUser = { ...user, isActive: false };

  const results = [
    await verifyLoginCredentials(undefined, 'wrong-password'),
    await verifyLoginCredentials(user, 'wrong-password'),
    await verifyLoginCredentials(inactiveUser, 'correct-test-password')
  ];
  assert.deepEqual(results, [false, false, false]);

  assert.deepEqual(results, [false, false, false]);
  assert.equal(await verifyLoginCredentials(user, 'correct-test-password'), true);
  assert.equal(await verifyLoginCredentials({ ...user, emailVerified: false }, 'correct-test-password'), false);
});

test('email OTP generation, digest binding, masking, and expiry configuration are safe', () => {
  const codes = new Set(Array.from({ length: 100 }, () => generateEmailOtpCode()));
  assert.ok([...codes].every((code) => /^\d{6}$/.test(code)));
  assert.ok(codes.size > 1);

  const digest = createEmailOtpDigest('user-1', 'registration-token', '001204');
  assert.equal(compareEmailOtpDigests(digest, createEmailOtpDigest('user-1', 'registration-token', '001204')), true);
  assert.equal(compareEmailOtpDigests(digest, createEmailOtpDigest('user-2', 'registration-token', '001204')), false);
  assert.equal(compareEmailOtpDigests(digest, createEmailOtpDigest('user-1', 'another-token', '001204')), false);
  const tokenHashDigest = createEmailOtpDigestForTokenHash('user-1', 'hashed-registration-token', '001204');
  assert.equal(compareEmailOtpDigests(tokenHashDigest, createEmailOtpDigestForTokenHash('user-1', 'hashed-registration-token', '001204')), true);
  assert.equal(compareEmailOtpDigests(tokenHashDigest, createEmailOtpDigestForTokenHash('user-1', 'another-token-hash', '001204')), false);
  assert.equal(maskEmailAddress('yohannes@example.test'), 'y******s@example.test');
  assert.equal(maskEmailAddress('ab@example.test'), 'a*@example.test');

  const previousTtl = process.env.EMAIL_OTP_TTL_MINUTES;
  process.env.EMAIL_OTP_TTL_MINUTES = '31';
  assert.throws(() => getEmailOtpTtlMinutes(), /between 5 and 30/);
  if (previousTtl === undefined) delete process.env.EMAIL_OTP_TTL_MINUTES;
  else process.env.EMAIL_OTP_TTL_MINUTES = previousTtl;
});

test('registration creates a pending account and stores a digest before email delivery', async () => {
  let createdUserId = '';
  const statements: Array<{ statement: string; params: unknown[] }> = [];
  const restoreDatabase = mockDatabase(async (statement, params) => {
    statements.push({ statement, params });
    if (statement.startsWith('SELECT id, email, "fullName"')) return { rows: [], rowCount: 0 };
    if (statement.startsWith('INSERT INTO users')) createdUserId = String(params[0]);
    if (statement.startsWith('SELECT id FROM users WHERE email')) {
      return { rows: createdUserId ? [{ id: createdUserId }] : [], rowCount: createdUserId ? 1 : 0 };
    }
    if (statement.includes('FROM email_verification_challenges v JOIN users')) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });

  try {
    const result = await register({
      email: 'person@example.test',
      password: 'strong-registration-password',
      fullName: 'Test User',
      role: 'JOB_SEEKER',
    });
    const accountInsert = statements.find(({ statement }) => statement.startsWith('INSERT INTO users'));
    const challengeInsert = statements.find(({ statement }) => statement.startsWith('INSERT INTO email_verification_challenges'));

    assert.equal(result.deliverable, true);
    assert.equal(result.requiresCommit, false);
    assert.equal(result.userId, createdUserId);
    assert.match(result.code, /^\d{6}$/);
    assert.ok(accountInsert?.statement.includes('false, false'));
    assert.ok(challengeInsert?.params.includes(createEmailOtpDigestForTokenHash(
      createdUserId,
      createHash('sha256').update(result.token).digest('hex'),
      result.code,
    )));
    assert.equal(challengeInsert?.params.includes(result.code), false);
  } finally {
    restoreDatabase();
  }
});

test('verification-code requests are deliverable only for eligible pending registrations', async () => {
  for (const emailVerified of [false, true]) {
    const statements: string[] = [];
    const restoreDatabase = mockDatabase(async (statement) => {
      statements.push(statement);
      if (statement.startsWith('SELECT id, email, "fullName"')) {
        return {
          rows: [{
            id: 'pending-user',
            email: 'person@example.test',
            fullName: 'Test User',
            role: 'JOB_SEEKER',
            isActive: emailVerified,
            emailVerified,
            archivedAt: null,
          }],
          rowCount: 1,
        };
      }
      if (statement.includes('FROM email_verification_challenges v JOIN users')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });

    try {
      const result = await requestRegistrationEmailVerification(' PERSON@example.test ');
      assert.equal(result.email, 'person@example.test');
      assert.equal(result.deliverable, !emailVerified);
      assert.equal(result.userId, emailVerified ? '' : 'pending-user');
      assert.match(result.code, /^\d{6}$/);
      assert.ok(statements.some((statement) => statement.startsWith('INSERT INTO email_verification_challenges')));
    } finally {
      restoreDatabase();
    }
  }

  assert.equal(requestEmailVerificationSchema.safeParse({ email: 'person@example.test' }).success, true);
  assert.equal(requestEmailVerificationSchema.safeParse({ email: 'not-an-email' }).success, false);
});

test('password reset preparation is decoy-based for unknown emails and stores only digests', async () => {
  for (const existingAccount of [true, false]) {
    const statements: Array<{ statement: string; params: unknown[] }> = [];
    const restoreDatabase = mockDatabase(async (statement, params) => {
      statements.push({ statement, params });
      if (statement.startsWith('SELECT id, email FROM users')) {
        return existingAccount
          ? { rows: [{ id: 'reset-user-1', email: 'person@example.test' }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });

    try {
      const result = await preparePasswordReset('PERSON@example.test');
      const insert = statements.find(({ statement }) => statement.startsWith('INSERT INTO password_reset_challenges'));
      assert.equal(result.shouldSendEmail, existingAccount);
      assert.equal(result.email, 'person@example.test');
      assert.equal(result.commitOnAcceptance, existingAccount);
      assert.match(result.code, /^\d{6}$/);
      assert.ok(insert);
      assert.equal(insert.params.includes(result.code), false);
      assert.equal(insert.params.includes(result.token), false);
      assert.equal(result.cookieToken, result.token);
    } finally {
      restoreDatabase();
    }
  }
});

test('password reset resend cooldown is checked before challenge state is changed', async () => {
  const fixture = createPasswordResetFixture({ lastSentAt: new Date() });
  const writes: string[] = [];
  const restoreDatabase = mockDatabase(async (statement) => {
    if (statement.startsWith('SELECT id, email FROM users')) return { rows: [{ id: fixture.row.userId, email: fixture.row.email }], rowCount: 1 };
    if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [fixture.row], rowCount: 1 };
    writes.push(statement);
    return { rows: [], rowCount: 1 };
  });

  try {
    const prepared = await preparePasswordReset(fixture.row.email, fixture.token);
    assert.equal(prepared.shouldSendEmail, false);
    assert.equal(prepared.cookieToken, fixture.token);
    assert.equal(writes.some((statement) => statement.startsWith('UPDATE ')), false);
  } finally {
    restoreDatabase();
  }
});

test('a replacement reset code is committed only after the provider accepts it', async () => {
  const fixture = createPasswordResetFixture();
  const storedHashes: string[] = [];
  const restoreDatabase = mockDatabase(async (statement, params) => {
    if (statement.startsWith('SELECT id, email FROM users')) return { rows: [{ id: fixture.row.userId, email: fixture.row.email }], rowCount: 1 };
    if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [fixture.row], rowCount: 1 };
    if (statement.startsWith('SELECT id FROM users WHERE id')) return { rows: [{ id: fixture.row.userId }], rowCount: 1 };
    if (statement.startsWith('UPDATE password_reset_challenges SET "tokenHash"')) storedHashes.push(String(params[1]));
    return { rows: [], rowCount: 1 };
  });

  try {
    const priorCodeHash = fixture.row.codeHash;
    const prepared = await preparePasswordReset(fixture.row.email, fixture.token);
    assert.equal(prepared.token, fixture.token);
    assert.equal(prepared.cookieToken, fixture.token);
    assert.equal(fixture.row.codeHash, priorCodeHash);
    assert.equal(storedHashes.length, 0);

    await commitPasswordResetCode(prepared);
    assert.equal(storedHashes.length, 1);
    assert.equal(storedHashes[0], createPasswordResetOtpDigest(fixture.row.userId, fixture.row.tokenHash, prepared.code));
  } finally {
    restoreDatabase();
  }
});

test('successful reset hashes the new password, preserves account state, audits, and consumes the code', async () => {
  const fixture = createPasswordResetFixture({ role: 'ADMIN', emailVerified: true, isActive: true, employerVerified: true });
  const statements: Array<{ statement: string; params: unknown[] }> = [];
  let storedPasswordHash = '';
  const restoreDatabase = mockDatabase(async (statement, params) => {
    statements.push({ statement, params });
    if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [fixture.row], rowCount: 1 };
    if (statement.startsWith('SELECT id, email, "fullName" FROM users')) {
      return { rows: [{ id: fixture.row.userId, email: fixture.row.email, fullName: fixture.row.fullName }], rowCount: 1 };
    }
    if (statement.startsWith('UPDATE users SET "passwordHash"')) {
      storedPasswordHash = String(params[0]);
      return { rows: [], rowCount: 1 };
    }
    if (statement.startsWith('UPDATE password_reset_challenges SET "consumedAt"')) fixture.row.consumedAt = new Date();
    return { rows: [], rowCount: 1 };
  });

  try {
    const result = await completePasswordReset(fixture.row.email, fixture.token, fixture.code, 'a-new-strong-password');
    assert.equal(result?.userId, fixture.row.userId);
    assert.equal(await bcrypt.compare('a-new-strong-password', storedPasswordHash), true);
    assert.equal(await bcrypt.compare('password-reset-test-token', storedPasswordHash), false);
    const passwordUpdate = statements.find(({ statement }) => statement.startsWith('UPDATE users SET "passwordHash"'));
    assert.equal(passwordUpdate?.statement.includes('"authVersion" = "authVersion" + 1'), true);
    const passwordUpdateSet = passwordUpdate?.statement.split('WHERE')[0] || '';
    assert.equal(passwordUpdateSet.includes('"emailVerified" ='), false);
    assert.equal(passwordUpdateSet.includes('"role" ='), false);
    assert.equal(passwordUpdateSet.includes('employer'), false);
    assert.ok(statements.some(({ statement }) => statement.startsWith('UPDATE password_reset_challenges SET "consumedAt"')));
    assert.ok(statements.some(({ statement }) => statement.includes("'PASSWORD_RESET'")));
    assert.ok(fixture.row.consumedAt);
  } finally {
    restoreDatabase();
  }
});

test('reset OTP attempts are bounded and expired or consumed challenges cannot be reused', async () => {
  const fixture = createPasswordResetFixture();
  let updates = 0;
  const restoreDatabase = mockDatabase(async (statement, params) => {
    if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [fixture.row], rowCount: 1 };
    if (statement.startsWith('SELECT id, email, "fullName" FROM users')) {
      return { rows: [{ id: fixture.row.userId, email: fixture.row.email, fullName: fixture.row.fullName }], rowCount: 1 };
    }
    if (statement.startsWith('UPDATE password_reset_challenges SET "failedAttempts"')) {
      fixture.row.failedAttempts = Number(params[0]);
      if (fixture.row.failedAttempts >= 5) fixture.row.consumedAt = new Date();
      updates += 1;
    }
    return { rows: [], rowCount: 1 };
  });

  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await assert.rejects(
        completePasswordReset(fixture.row.email, fixture.token, '000000', 'a-new-strong-password'),
        (error: unknown) => error instanceof AuthError && error.statusCode === (attempt === 5 ? 429 : 400)
      );
    }
    await assert.rejects(
      completePasswordReset(fixture.row.email, fixture.token, fixture.code, 'a-new-strong-password'),
      (error: unknown) => error instanceof AuthError && error.statusCode === 400
    );
    assert.equal(updates, 5);
    assert.ok(fixture.row.consumedAt);
  } finally {
    restoreDatabase();
  }

  for (const overrides of [
    { expiresAt: new Date(Date.now() - 1_000) },
    { consumedAt: new Date() },
  ]) {
    const expired = createPasswordResetFixture(overrides);
    let passwordUpdateCount = 0;
    const restoreExpiredDatabase = mockDatabase(async (statement) => {
      if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [expired.row], rowCount: 1 };
      if (statement.startsWith('SELECT id, email, "fullName" FROM users')) {
        return { rows: [{ id: expired.row.userId, email: expired.row.email, fullName: expired.row.fullName }], rowCount: 1 };
      }
      if (statement.startsWith('UPDATE users SET "passwordHash"')) passwordUpdateCount += 1;
      return { rows: [], rowCount: 1 };
    });
    try {
      await assert.rejects(
        completePasswordReset(expired.row.email, expired.token, expired.code, 'a-new-strong-password'),
        (error: unknown) => error instanceof AuthError && error.statusCode === 400
      );
      assert.equal(passwordUpdateCount, 0);
    } finally {
      restoreExpiredDatabase();
    }
  }
});

test('concurrent valid reset submissions can update the password only once', async () => {
  const fixture = createPasswordResetFixture();
  let passwordUpdates = 0;
  const restoreDatabase = mockDatabase(async (statement, params) => {
    if (statement.startsWith('SELECT * FROM password_reset_challenges')) return { rows: [fixture.row], rowCount: 1 };
    if (statement.startsWith('SELECT id, email, "fullName" FROM users')) {
      return { rows: [{ id: fixture.row.userId, email: fixture.row.email, fullName: fixture.row.fullName }], rowCount: 1 };
    }
    if (statement.startsWith('UPDATE users SET "passwordHash"')) {
      passwordUpdates += 1;
      return { rows: [], rowCount: 1 };
    }
    if (statement.startsWith('UPDATE password_reset_challenges SET "consumedAt"')) fixture.row.consumedAt = new Date();
    return { rows: [], rowCount: 1 };
  }, true);

  try {
    const attempts = await Promise.allSettled([
      completePasswordReset(fixture.row.email, fixture.token, fixture.code, 'a-new-strong-password'),
      completePasswordReset(fixture.row.email, fixture.token, fixture.code, 'another-strong-password'),
    ]);
    assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(passwordUpdates, 1);
  } finally {
    restoreDatabase();
  }
});

test('auth versions revoke existing JWT sessions after a password reset', async () => {
  const oldToken = generateToken({ userId: 'session-user', email: 'person@example.test', role: 'JOB_SEEKER', authVersion: 0 });
  const decoded = verifyToken(oldToken);
  assert.equal(decoded.authVersion, 0);

  const restoreDatabase = mockDatabase(async () => ({
    rows: [{ id: 'session-user', email: 'person@example.test', role: 'JOB_SEEKER', fullName: 'Test User', isActive: true, emailVerified: true, authVersion: 1 }],
    rowCount: 1,
  }));
  try {
    assert.equal(await resolveAuthenticatedUser(decoded.userId, decoded.authVersion), undefined);
    const authenticatedUser = await resolveAuthenticatedUser(decoded.userId, 1);
    assert.equal(authenticatedUser?.authVersion, 1);
    assert.equal(authenticatedUser?.emailVerified, true);
  } finally {
    restoreDatabase();
  }
});

test('verification email requires configuration without invoking an email provider', async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousSender = process.env.OTP_FROM_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.OTP_FROM_EMAIL;
  const originalConsoleError = console.error;
  console.error = () => {};
  let providerCalled = false;

  try {
    await assert.rejects(
      sendVerificationEmail('person@example.test', '001204', async () => {
        providerCalled = true;
        return { error: null };
      }),
      (error: unknown) => error instanceof AuthError && error.statusCode === 503
    );
    assert.equal(providerCalled, false);
  } finally {
    console.error = originalConsoleError;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousSender === undefined) delete process.env.OTP_FROM_EMAIL;
    else process.env.OTP_FROM_EMAIL = previousSender;
  }
});

test('verification email configuration requires the verified sender address', () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousSender = process.env.OTP_FROM_EMAIL;
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.OTP_FROM_EMAIL = 'SKILLBRIDGE ET <securityteam@kueiyiee.tech>';
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    assert.doesNotThrow(assertEmailDeliveryConfigured);
    process.env.OTP_FROM_EMAIL = 'SKILLBRIDGE ET <onboarding@resend.dev>';
    assert.throws(assertEmailDeliveryConfigured, (error: unknown) => error instanceof AuthError && error.statusCode === 503);
  } finally {
    console.error = originalConsoleError;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousSender === undefined) delete process.env.OTP_FROM_EMAIL;
    else process.env.OTP_FROM_EMAIL = previousSender;
  }
});

test('verification email payload is sent through the injectable provider and provider errors stay generic', async () => {
  const keys = ['RESEND_API_KEY', 'OTP_FROM_EMAIL', 'APP_NAME', 'SUPPORT_EMAIL', 'EMAIL_VERIFICATION_URL', 'APP_URL', 'EMAIL_OTP_TTL_MINUTES'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.OTP_FROM_EMAIL = 'SKILLBRIDGE ET <securityteam@kueiyiee.tech>';
  process.env.APP_NAME = '<SkillBridge>';
  process.env.SUPPORT_EMAIL = 'help@example.test';
  process.env.EMAIL_VERIFICATION_URL = 'https://example.test/verify-email';
  process.env.EMAIL_OTP_TTL_MINUTES = '10';
  let capturedFrom = '';
  let capturedTo = '';
  let capturedHtml = '';
  let capturedText = '';
  let deliveredApiKey = '';
  let providerLog = '';
  const originalConsoleInfo = console.info;

  try {
    console.info = (...args: unknown[]) => { providerLog += JSON.stringify(args); };
    const sent = await sendVerificationEmail('person@example.test', '001204', async (apiKey, payload) => {
      deliveredApiKey = apiKey;
      capturedFrom = String(payload.from ?? '');
      capturedTo = Array.isArray(payload.to) ? payload.to.join(',') : String(payload.to ?? '');
      capturedHtml = String(payload.html ?? '');
      capturedText = payload.text ?? '';
      return { data: { id: 'resend-test-message-123' }, error: null };
    }, { requestId: 'request-test-123' });
    assert.deepEqual(sent, { messageId: 'resend-test-message-123' });
    assert.match(providerLog, /resend-test-message-123/);
    assert.match(providerLog, /request-test-123/);
    assert.equal(deliveredApiKey, 'test-resend-key');
    assert.equal(capturedTo, 'person@example.test');
    assert.equal(capturedFrom, 'SKILLBRIDGE ET <securityteam@kueiyiee.tech>');
    assert.match(capturedHtml, /001204/);
    assert.match(capturedText, /001204/);
    assert.match(capturedHtml, /&lt;SkillBridge&gt;/);
    assert.match(capturedHtml, /expires in 10 minutes from when it was sent/);
    assert.match(capturedText, /expires in 10 minutes from when it was sent/);

    const isGenericProviderError = (error: unknown) => error instanceof AuthError
      && error.statusCode === 503
      && !error.message.includes('provider-private-detail')
      && !error.message.includes('test-resend-key')
      && !error.message.includes('001204');
    const originalConsoleError = console.error;
    const loggedOutput: unknown[][] = [];
    console.error = (...args: unknown[]) => { loggedOutput.push(args); };
    try {
      await assert.rejects(
        sendVerificationEmail('person@example.test', '001204', async () => ({
          error: new Error('provider-private-detail')
        })),
        isGenericProviderError
      );
      await assert.rejects(
        sendVerificationEmail('person@example.test', '001204', async () => ({ error: null })),
        isGenericProviderError
      );
      await assert.rejects(
        sendVerificationEmail('person@example.test', '001204', async () => {
          throw new Error('provider-private-detail');
        }),
        isGenericProviderError
      );
    } finally {
      console.error = originalConsoleError;
    }
    const logs = JSON.stringify(loggedOutput);
    assert.equal(logs.includes('test-resend-key'), false);
    assert.equal(logs.includes('001204'), false);
    assert.equal(logs.includes('provider-private-detail'), false);
    assert.equal(providerLog.includes('001204'), false);
    assert.equal(providerLog.includes('person@example.test'), false);

    await assert.rejects(
      sendVerificationEmail('not-an-email', '001204', async () => ({ error: null })),
      (error: unknown) => error instanceof AuthError && error.statusCode === 400
    );
    await assert.rejects(
      sendVerificationEmail('person@example.test', '<script>', async () => ({ error: null })),
      (error: unknown) => error instanceof AuthError && error.statusCode === 400
    );
  } finally {
    console.info = originalConsoleInfo;
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('verification links use the frontend origin and honor production configuration', () => {
  const keys = ['EMAIL_VERIFICATION_URL', 'APP_URL'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.EMAIL_VERIFICATION_URL;
    delete process.env.APP_URL;
    assert.equal(getEmailVerificationUrl(), 'http://127.0.0.1:5173/verify-email');

    process.env.EMAIL_VERIFICATION_URL = 'https://skillbridge.example/verify-email';
    assert.equal(getEmailVerificationUrl(), 'https://skillbridge.example/verify-email');

    delete process.env.EMAIL_VERIFICATION_URL;
    process.env.APP_URL = 'https://skillbridge.example';
    assert.equal(getEmailVerificationUrl(), 'https://skillbridge.example/verify-email');
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('verification resend preserves the existing code until the replacement is committed', async () => {
  const fixture = createVerificationFixture();
  const statements: string[] = [];
  const restoreDatabase = mockDatabase(async (statement) => {
    statements.push(statement);
    return statement.startsWith('SELECT v.*')
      ? { rows: [fixture.row], rowCount: 1 }
      : { rows: [], rowCount: 1 };
  });

  try {
    const prepared = await resendEmailVerificationCode(fixture.token);
    assert.equal(prepared.shouldSendEmail, true);
    assert.match(prepared.code, /^\d{6}$/);
    assert.equal(fixture.row.codeHash, createEmailOtpDigest('verify-user-1', fixture.token, fixture.code));
    assert.equal(statements.some((statement) => statement.includes('SET "lastSentAt"') && statement.includes('"codeHash"')), false);

    await commitEmailVerificationResend(fixture.token, prepared.code);
    assert.ok(statements.some((statement) => statement.includes('SET "codeHash"')));
  } finally {
    restoreDatabase();
  }
});

test('verification resend enforces its cooldown without changing the challenge', async () => {
  const fixture = createVerificationFixture({ lastSentAt: new Date() });
  let writes = 0;
  const restoreDatabase = mockDatabase(async (statement) => {
    if (statement.startsWith('SELECT v.*')) return { rows: [fixture.row], rowCount: 1 };
    writes += 1;
    return { rows: [], rowCount: 1 };
  });

  try {
    await assert.rejects(
      resendEmailVerificationCode(fixture.token),
      (error: unknown) => error instanceof AuthError && error.statusCode === 429
    );
    assert.equal(writes, 0);
  } finally {
    restoreDatabase();
  }
});

test('pending provisioned administrators can request an OTP without public ADMIN registration', async () => {
  const fixture = createVerificationFixture({ role: 'ADMIN' });
  const restoreDatabase = mockDatabase(async (statement) => {
    if (statement.includes('FROM users WHERE email = $1 LIMIT 1')) {
      return {
        rows: [{
          id: fixture.row.userId,
          email: fixture.row.email,
          fullName: fixture.row.fullName,
          role: 'ADMIN',
          isActive: false,
          emailVerified: false,
          archivedAt: null,
        }],
        rowCount: 1,
      };
    }
    if (statement.includes('FROM email_verification_challenges v JOIN users u')) {
      return { rows: [fixture.row], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });

  try {
    const requested = await requestRegistrationEmailVerification('person@example.test');
    assert.equal(requested.deliverable, true);
    assert.equal(requested.userId, fixture.row.userId);
    assert.equal(requested.email, fixture.row.email);
  } finally {
    restoreDatabase();
  }
});

test('administrator OTP resend respects the shared account cooldown', async () => {
  const fixture = createVerificationFixture({ role: 'ADMIN', lastSentAt: new Date() });
  let writes = 0;
  const restoreDatabase = mockDatabase(async (statement) => {
    if (statement.startsWith('SELECT v.*')) {
      assert.match(statement, /u\.role IN \('JOB_SEEKER', 'EMPLOYER', 'ADMIN'\)/);
      return { rows: [fixture.row], rowCount: 1 };
    }
    writes += 1;
    return { rows: [], rowCount: 1 };
  });

  try {
    await assert.rejects(
      prepareAdminEmailVerificationResend(fixture.row.userId),
      (error: unknown) => error instanceof AuthError && error.statusCode === 429,
    );
    assert.equal(writes, 0);
  } finally {
    restoreDatabase();
  }
});

test('email verification rejects wrong and expired codes without activating the account', async () => {
  for (const fixture of [
    createVerificationFixture(),
    createVerificationFixture({ expiresAt: new Date(Date.now() - 1_000) }),
  ]) {
    let accountActivated = false;
    const restoreDatabase = mockDatabase(async (statement) => {
      if (statement.startsWith('SELECT v.*')) return { rows: [fixture.row], rowCount: 1 };
      if (statement.startsWith('UPDATE users')) accountActivated = true;
      return { rows: [], rowCount: 1 };
    });

    try {
      const expectedStatus = new Date(fixture.row.expiresAt as string | Date).getTime() < Date.now() ? 410 : 400;
      await assert.rejects(
        verifyEmailVerificationCode(fixture.token, '999999'),
        (error: unknown) => error instanceof AuthError && error.statusCode === expectedStatus
      );
      assert.equal(accountActivated, false);
    } finally {
      restoreDatabase();
    }
  }
});

test('valid email verification activates the account and returns an authenticated session', async () => {
  const fixture = createVerificationFixture();
  let accountActivated = false;
  let challengeConsumed = false;
  const restoreDatabase = mockDatabase(async (statement) => {
    if (statement.startsWith('SELECT v.*')) return { rows: [fixture.row], rowCount: 1 };
    if (statement.startsWith('UPDATE users')) accountActivated = true;
    if (statement.includes('SET "verifiedAt"')) challengeConsumed = true;
    return { rows: [], rowCount: statement.startsWith('UPDATE users') ? 1 : 1 };
  });

  try {
    const result = await verifyEmailVerificationCode(fixture.token, fixture.code);
    assert.equal(result.user.id, 'verify-user-1');
    assert.equal(result.user.email, 'person@example.test');
    assert.ok(result.token);
    assert.equal(accountActivated, true);
    assert.equal(challengeConsumed, true);
  } finally {
    restoreDatabase();
  }
});

test('password reset and password changed emails use distinct safe templates', async () => {
  const keys = ['RESEND_API_KEY', 'OTP_FROM_EMAIL', 'APP_NAME', 'SUPPORT_EMAIL', 'EMAIL_OTP_TTL_MINUTES'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.OTP_FROM_EMAIL = 'SKILLBRIDGE ET <securityteam@kueiyiee.tech>';
  process.env.APP_NAME = 'SKILLBRIDGE ET';
  process.env.SUPPORT_EMAIL = 'help@example.test';
  process.env.EMAIL_OTP_TTL_MINUTES = '10';
  const sentPayloads: Array<{ subject: string; html: string; text: string }> = [];
  const originalConsoleInfo = console.info;
  console.info = () => {};

  try {
    const mockedSender = async (_key: string, payload: { subject?: string; html?: string; text?: string }) => {
      sentPayloads.push({
        subject: payload.subject || '',
        html: payload.html || '',
        text: payload.text || '',
      });
      return { data: { id: `reset-test-${sentPayloads.length}` }, error: null };
    };
    await sendPasswordResetEmail('person@example.test', '007421', mockedSender);
    await sendPasswordChangedEmail('person@example.test', mockedSender);
    assert.match(sentPayloads[0].subject, /Reset your .* password/);
    assert.match(sentPayloads[0].html, /007421/);
    assert.match(sentPayloads[0].text, /expires in 10 minutes/);
    assert.match(sentPayloads[1].subject, /password was changed/);
    assert.match(sentPayloads[1].text, /contact support immediately/);
    assert.equal(sentPayloads[1].text.includes('007421'), false);
    assert.equal(sentPayloads[1].text.includes('new password is'), false);

    await assert.rejects(
      sendPasswordResetEmail('person@example.test', '007421', async () => ({ error: new Error('private-provider-detail') })),
      (error: unknown) => error instanceof AuthError && error.statusCode === 503 && !error.message.includes('private-provider-detail')
    );
  } finally {
    console.info = originalConsoleInfo;
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('signed sessions expire within one hour and carry a revocation id', () => {
  const before = Math.floor(Date.now() / 1000);
  const token = generateToken({ userId: 'admin-1', email: 'admin@example.test', role: 'ADMIN' });
  const session = verifyToken(token);
  assert.ok(session.sessionId);
  assert.ok(session.sessionExpiresAt);
  assert.ok(session.sessionExpiresAt! <= before + 3601);
  assert.ok(session.sessionExpiresAt! > before);
});

test('job seekers and employers cannot pass the administrator role guard', () => {
  for (const role of ['JOB_SEEKER', 'EMPLOYER'] as AuthRole[]) {
    let statusCode = 0;
    let nextCalled = false;
    const request = { user: { userId: 'user-1', email: 'user@example.test', role } } as Request;
    const response = {
      status(code: number) { statusCode = code; return this; },
      json() { return this; }
    } as unknown as Response;

    requireRole('ADMIN')(request, response, () => { nextCalled = true; });
    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);
  }
});

test('the last active administrator cannot delete their account', () => {
  assert.throws(() => assertCanDeleteAdminAccount('ADMIN', 1), /last active administrator/);
  assert.doesNotThrow(() => assertCanDeleteAdminAccount('ADMIN', 2));
  assert.doesNotThrow(() => assertCanDeleteAdminAccount('JOB_SEEKER', 1));
});