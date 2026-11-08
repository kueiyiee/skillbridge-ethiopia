import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../../infrastructure/database/drizzle';
import { manuallyVerifyEmail } from './admin.email-verification.service';
import { listUsers } from './admin.repository';
import { adminUsersQuerySchema } from './admin.schemas';

const actor = { userId: 'admin-1', fullName: 'Administrator', requestId: 'request-1' };

test('manual email verification records prior and resulting states with administrator reason', async () => {
  const originalTransaction = db.transaction;
  const statements: Array<{ statement: string; params: unknown[] }> = [];
  let transactionCalled = false;
  db.transaction = async (callback) => {
    transactionCalled = true;
    return callback({
      query: async <T = any>(statement: string, params: unknown[] = []) => {
        statements.push({ statement, params });
        if (statement.includes('SELECT id, "emailVerified"')) {
          return {
            rows: [{ id: 'user-1', emailVerified: false, emailVerificationMethod: null, emailVerifiedAt: null, isActive: false, role: 'JOB_SEEKER' }] as T[],
            rowCount: 1,
          };
        }
        if (statement.includes('SELECT "verifiedAt" FROM email_verification_challenges')) return { rows: [] as T[], rowCount: 0 };
        return { rows: [] as T[], rowCount: 1 };
      },
    });
  };

  try {
    assert.equal(await manuallyVerifyEmail('user-1', actor, 'Reviewed mailbox ownership evidence'), 'updated');
    assert.equal(transactionCalled, true);
    const lockedRead = statements.find(({ statement }) => statement.includes('SELECT id, "emailVerified"'));
    assert.match(lockedRead?.statement ?? '', /FOR UPDATE/);
    const update = statements.find(({ statement }) => statement.startsWith('UPDATE users SET'));
    assert.match(update?.statement ?? '', /"emailVerifiedAt" = CURRENT_TIMESTAMP/);
    const audit = statements.find(({ statement }) => statement.includes('ADMIN_EMAIL_VERIFIED_MANUALLY'));
    assert.ok(audit);
    assert.equal(audit.params[1], actor.userId);
    assert.equal(audit.params[2], 'user-1');
    const details = JSON.parse(String(audit.params[3])) as {
      previousState: { emailVerified: boolean };
      newState: { emailVerified: boolean; emailVerificationMethod: string };
      reason: string;
    };
    assert.deepEqual(details.previousState, {
      emailVerified: false,
      emailVerificationMethod: null,
      emailVerifiedAt: null,
      isActive: false,
    });
    assert.equal(details.newState.emailVerified, true);
    assert.equal(details.newState.emailVerificationMethod, 'admin_manual');
    assert.equal(details.reason, 'Reviewed mailbox ownership evidence');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('manual email verification rejects self-verification without opening a transaction', async () => {
  const originalTransaction = db.transaction;
  db.transaction = async () => {
    throw new Error('Self-verification must not reach the database.');
  };
  try {
    assert.equal(await manuallyVerifyEmail(actor.userId, actor, 'Required reason'), 'self_verification');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('administrator can resolve legacy action-required state with a reason and audited manual evidence', async () => {
  const originalTransaction = db.transaction;
  const statements: Array<{ statement: string; params: unknown[] }> = [];
  db.transaction = async (callback) => callback({
    query: async <T = any>(statement: string, params: unknown[] = []) => {
      statements.push({ statement, params });
      if (statement.includes('SELECT id, "emailVerified"')) {
        return {
          rows: [{ id: 'user-legacy', emailVerified: true, emailVerificationMethod: null, emailVerifiedAt: null, isActive: true, role: 'JOB_SEEKER' }] as T[],
          rowCount: 1,
        };
      }
      if (statement.includes('SELECT "verifiedAt" FROM email_verification_challenges')) return { rows: [] as T[], rowCount: 0 };
      return { rows: [] as T[], rowCount: 1 };
    },
  });

  try {
    assert.equal(await manuallyVerifyEmail('user-legacy', actor, 'Reviewed mailbox ownership with the account holder'), 'updated');
    const update = statements.find(({ statement }) => statement.startsWith('UPDATE users SET'));
    assert.match(update?.statement ?? '', /"emailVerificationMethod" = 'admin_manual'/);
    assert.deepEqual(update?.params, ['user-legacy', true]);
    assert.equal(statements.some(({ statement }) => statement.startsWith('UPDATE email_verification_challenges')), false);
    const audit = statements.find(({ statement }) => statement.includes('ADMIN_EMAIL_VERIFIED_MANUALLY'));
    assert.ok(audit);
    const details = JSON.parse(String(audit.params[3])) as {
      previousState: { emailVerified: boolean; emailVerificationMethod: string | null };
      newState: { emailVerified: boolean; emailVerificationMethod: string };
      evidenceSource: string;
      reason: string;
    };
    assert.equal(details.previousState.emailVerified, true);
    assert.equal(details.previousState.emailVerificationMethod, null);
    assert.equal(details.newState.emailVerified, true);
    assert.equal(details.newState.emailVerificationMethod, 'admin_manual');
    assert.equal(details.evidenceSource, 'administrator_attestation');
    assert.equal(details.reason, 'Reviewed mailbox ownership with the account holder');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('administrator can correct an unverified flag when OTP evidence exists without fabricating OTP history', async () => {
  const originalTransaction = db.transaction;
  const statements: string[] = [];
  db.transaction = async (callback) => callback({
    query: async <T = any>(statement: string) => {
      statements.push(statement);
      if (statement.includes('SELECT id, "emailVerified"')) {
        return {
          rows: [{ id: 'user-conflict', emailVerified: false, emailVerificationMethod: null, emailVerifiedAt: null, isActive: true, role: 'JOB_SEEKER' }] as T[],
          rowCount: 1,
        };
      }
      if (statement.includes('SELECT "verifiedAt" FROM email_verification_challenges')) {
        return { rows: [{ verifiedAt: new Date('2026-10-20T10:00:00Z') }] as T[], rowCount: 1 };
      }
      return { rows: [] as T[], rowCount: 1 };
    },
  });

  try {
    assert.equal(await manuallyVerifyEmail('user-conflict', actor, 'Confirmed prior OTP verification in the account history'), 'updated');
    const update = statements.find((statement) => statement.startsWith('UPDATE users SET'));
    assert.match(update ?? '', /SET "emailVerified" = true, "updatedAt" = CURRENT_TIMESTAMP/);
    assert.doesNotMatch(update ?? '', /emailVerificationMethod.*admin_manual/);
    assert.equal(statements.some((statement) => statement.startsWith('UPDATE email_verification_challenges')), false);
  } finally {
    db.transaction = originalTransaction;
  }
});

test('manual verification does not replace OTP proof for administrator accounts', async () => {
  const originalTransaction = db.transaction;
  const statements: string[] = [];
  db.transaction = async (callback) => callback({
    query: async <T = any>(statement: string) => {
      statements.push(statement);
      if (statement.includes('SELECT id, "emailVerified"')) {
        return {
          rows: [{ id: 'admin-2', emailVerified: false, emailVerificationMethod: null, emailVerifiedAt: null, isActive: false, role: 'ADMIN' }] as T[],
          rowCount: 1,
        };
      }
      return { rows: [] as T[], rowCount: 1 };
    },
  });
  try {
    assert.equal(await manuallyVerifyEmail('admin-2', actor, 'Administrative mailbox review'), 'action_required');
    assert.equal(statements.some((statement) => statement.startsWith('UPDATE users SET')), false);
    assert.equal(statements.some((statement) => statement.startsWith('INSERT INTO platform_audit_logs')), true);
  } finally {
    db.transaction = originalTransaction;
  }
});

test('failed audit insertion rejects the manual verification transaction', async () => {
  const originalTransaction = db.transaction;
  let emailVerified = false;
  db.transaction = async (callback) => {
    try {
      return await callback({
        query: async <T = any>(statement: string) => {
          if (statement.includes('SELECT id, "emailVerified"')) {
            return {
              rows: [{ id: 'user-1', emailVerified, emailVerificationMethod: null, emailVerifiedAt: null, isActive: false, role: 'JOB_SEEKER' }] as T[],
              rowCount: 1,
            };
          }
          if (statement.includes('SELECT "verifiedAt" FROM email_verification_challenges')) return { rows: [] as T[], rowCount: 0 };
          if (statement.startsWith('UPDATE users SET')) {
            emailVerified = true;
            return { rows: [] as T[], rowCount: 1 };
          }
          if (statement.includes('ADMIN_EMAIL_VERIFIED_MANUALLY')) throw new Error('Audit insert failed.');
          return { rows: [] as T[], rowCount: 1 };
        },
      });
    } catch (error) {
      emailVerified = false;
      throw error;
    }
  };

  try {
    await assert.rejects(manuallyVerifyEmail('user-1', actor, 'Reviewed mailbox ownership evidence'), /Audit insert failed/);
    assert.equal(emailVerified, false);
  } finally {
    db.transaction = originalTransaction;
  }
});

test('user directory search, filters, pagination, and subsequent reads use current verification state', async () => {
  const originalQuery = db.query;
  const sqlCalls: Array<{ statement: string; params: unknown[] }> = [];
  let userRow: Record<string, unknown> = {
    id: 'user-1',
    email: 'kuey@example.test',
    fullName: 'Kuey Poy',
    phone: null,
    role: 'EMPLOYER',
    isActive: false,
    accountStatus: 'pending_verification',
    emailVerified: false,
    emailVerificationMethod: null,
    emailVerifiedAt: null,
    challengeVerifiedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  db.query = async <T = any>(statement: string, params: unknown[] = []) => {
    sqlCalls.push({ statement, params });
    if (statement.startsWith('SELECT count(*) AS count')) return { rows: [{ count: 1 }] as T[], rowCount: 1 };
    if (statement.includes('AS totalAccounts')) {
      return {
        rows: [{
          totalAccounts: 1,
          verifiedEmails: userRow.emailVerified ? 1 : 0,
          accountsNeedingVerification: userRow.emailVerified ? 0 : 1,
          emailVerificationActionRequired: 0,
          suspendedAccounts: 0,
        }] as T[],
        rowCount: 1,
      };
    }
    return { rows: [userRow] as T[], rowCount: 1 };
  };

  try {
    const filters = adminUsersQuerySchema.parse({
      page: '2',
      pageSize: '10',
      search: 'Kuey',
      role: 'EMPLOYER',
      status: 'pending_verification',
      emailStatus: 'unverified',
    });
    const firstResult = await listUsers(filters);
    const pageQuery = sqlCalls.find(({ statement }) => statement.includes('ORDER BY "createdAt" DESC'));
    assert.ok(pageQuery);
    assert.match(pageQuery.statement, /email LIKE \$1/);
    assert.match(pageQuery.statement, /role = \$2/);
    assert.match(pageQuery.statement, /LIMIT \$3 OFFSET \$4/);
    assert.deepEqual(pageQuery.params, ['%Kuey%', 'EMPLOYER', 10, 10]);
    assert.equal(firstResult.page, 2);
    assert.equal(firstResult.data[0].emailVerificationStatus, 'unverified');

    userRow = {
      ...userRow,
      isActive: true,
      accountStatus: 'active',
      emailVerified: true,
      emailVerificationMethod: 'email_otp',
      emailVerifiedAt: new Date('2026-02-01T00:00:00Z'),
    };
    const refreshed = await listUsers(adminUsersQuerySchema.parse({ emailStatus: 'verified' }));
    assert.equal(refreshed.data[0].emailVerificationStatus, 'verified');
    assert.equal(refreshed.summary.verifiedEmails, 1);
  } finally {
    db.query = originalQuery;
  }
});
