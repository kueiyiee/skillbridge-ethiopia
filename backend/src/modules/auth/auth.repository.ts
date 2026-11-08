import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import type { AuthActor, AuthDatabaseUser, AuthIdentityRow, AuthProfile, AuthRole, RegisterInput, AccountUpdateInput } from './auth.types';

export interface ExistingRegistration {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  isActive: boolean;
  emailVerified: boolean;
  archivedAt: Date | string | null;
}

export async function accountExists(email: string): Promise<boolean> {
  const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  return result.rowCount > 0;
}

export async function findRegistrationAccount(email: string): Promise<ExistingRegistration | undefined> {
  const result = await db.query<ExistingRegistration>(
    'SELECT id, email, "fullName", role, "isActive", "emailVerified", "archivedAt" FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  return result.rows[0];
}

export async function createAccount(
  userId: string,
  normalizedEmail: string,
  passwordHash: string,
  input: RegisterInput,
): Promise<boolean> {
  return db.transaction(async ({ query }) => {
    await query(
      `INSERT INTO users (id, email, "passwordHash", "fullName", phone, role, "isActive", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE id = id`,
      [userId, normalizedEmail, passwordHash, input.fullName, input.phone || null, input.role]
    );
    const account = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (account.rows[0]?.id !== userId) return false;

    if (input.role === 'JOB_SEEKER') {
      await query(
        `INSERT INTO job_seeker_profiles
         (id, "userId", headline, "institutionName", city, "availableForWork", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`prof-${randomUUID()}`, userId, 'Junior Software Engineer', input.companyOrSchool || 'University in Ethiopia', 'Addis Ababa']
      );
    } else {
      await query(
        `INSERT INTO employer_profiles
         (id, "userId", "companyName", industry, city, "isApproved", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`emp-${randomUUID()}`, userId, input.companyOrSchool || 'Enterprise Organization', 'Technology & Services', 'Addis Ababa']
      );
    }

    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, userId, 'USER_REGISTERED', 'User', userId, `Registered with role: ${input.role}`]
    );
    return true;
  });
}

export async function findUserForLogin(identifier: string): Promise<AuthDatabaseUser | undefined> {
  const result = await db.query<AuthDatabaseUser>(
    `SELECT id, email, "passwordHash", "fullName", role, "isActive", "emailVerified", "authVersion" FROM users
     WHERE (email = $1 OR username = $1) AND "archivedAt" IS NULL
     ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [identifier]
  );
  return result.rows[0];
}

export async function isAuthTokenRevoked(tokenId: string): Promise<boolean> {
  const result = await db.query(
    'SELECT tokenId FROM auth_token_revocations WHERE tokenId = $1 AND "expiresAt" > CURRENT_TIMESTAMP',
    [tokenId]
  );
  return result.rowCount > 0;
}

export async function revokeAuthToken(tokenId: string, expiresAt: number): Promise<void> {
  await db.query('DELETE FROM auth_token_revocations WHERE "expiresAt" <= CURRENT_TIMESTAMP');
  await db.query(
    'INSERT INTO auth_token_revocations (tokenId, "expiresAt") VALUES ($1, FROM_UNIXTIME($2)) ON DUPLICATE KEY UPDATE tokenId = VALUES(tokenId)',
    [tokenId, expiresAt]
  );
}

export async function findActiveAuthenticatedUser(userId: string): Promise<AuthIdentityRow | undefined> {
  const result = await db.query<AuthIdentityRow>(
    'SELECT id, email, role, "fullName", "isActive", "emailVerified", "authVersion" FROM users WHERE id = $1 AND "isActive" = true AND "emailVerified" = true AND "archivedAt" IS NULL',
    [userId]
  );
  return result.rows[0];
}

export async function getInstitutionOrCompany(userId: string, role: AuthRole): Promise<string> {
  if (role === 'JOB_SEEKER') {
    const result = await db.query<{ institutionName: string | null }>(
      'SELECT "institutionName" FROM job_seeker_profiles WHERE "userId" = $1',
      [userId]
    );
    return result.rows[0]?.institutionName || '';
  }
  if (role === 'EMPLOYER') {
    const result = await db.query<{ companyName: string | null }>(
      'SELECT "companyName" FROM employer_profiles WHERE "userId" = $1',
      [userId]
    );
    return result.rows[0]?.companyName || '';
  }
  return '';
}

export async function getProfile(actor: AuthActor): Promise<AuthProfile | null> {
  if (actor.role === 'JOB_SEEKER') {
    const result = await db.query<AuthProfile>('SELECT * FROM job_seeker_profiles WHERE "userId" = $1', [actor.userId]);
    const profile = result.rows[0];
    if (!profile) return null;
    const skills = await db.query('SELECT jsk.*, s.name AS "skillName", s.category FROM job_seeker_skills jsk JOIN skills s ON jsk."skillId" = s.id WHERE jsk."jobSeekerId" = $1', [profile.id]);
    return { ...profile, skills: skills.rows };
  }
  if (actor.role === 'EMPLOYER') {
    const result = await db.query<AuthProfile>('SELECT * FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL', [actor.userId]);
    const profile = result.rows[0];
    if (!profile) return null;
    const verification = await db.query('SELECT * FROM employer_verification_records WHERE "employerId" = $1 AND "archivedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1', [profile.id]);
    return { ...profile, verification: verification.rows[0] || null };
  }
  return null;
}

export async function updateAccount(userId: string, input: AccountUpdateInput): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [userId];
  if (input.fullName) {
    params.push(input.fullName);
    updates.push(`"fullName" = $${params.length}`);
  }
  if (input.phone !== undefined) {
    params.push(input.phone);
    updates.push(`phone = $${params.length}`);
  }
  if (updates.length === 0) return;
  updates.push('"updatedAt" = CURRENT_TIMESTAMP');
  await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $1`, params);
}

export async function getPasswordHash(userId: string): Promise<string | undefined> {
  const result = await db.query<{ passwordHash: string }>('SELECT "passwordHash" FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.passwordHash;
}

export async function replacePasswordAndRevokeSession(
  userId: string,
  currentHash: string,
  newHash: string,
  sessionId: string,
  sessionExpiresAt: number,
): Promise<number | null> {
  return db.transaction(async ({ query }) => {
    const update = await query(
      'UPDATE users SET "passwordHash" = $1, "authVersion" = "authVersion" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 AND "passwordHash" = $3 AND "isActive" = true',
      [newHash, userId, currentHash]
    );
    if (update.rowCount !== 1) return null;

    await query('DELETE FROM auth_token_revocations WHERE "expiresAt" <= CURRENT_TIMESTAMP');
    await query(
      'INSERT INTO auth_token_revocations (tokenId, "expiresAt") VALUES ($1, FROM_UNIXTIME($2)) ON DUPLICATE KEY UPDATE tokenId = VALUES(tokenId)',
      [sessionId, sessionExpiresAt]
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, userId, 'PASSWORD_CHANGED', 'User', userId, 'Account password updated; no credential values are recorded.']
    );
    const version = await query<{ authVersion: number }>('SELECT "authVersion" FROM users WHERE id = $1', [userId]);
    return Number(version.rows[0]?.authVersion);
  });
}

export async function deleteAccount(actor: AuthActor): Promise<boolean> {
  return db.transaction(async ({ query }) => {
    if (actor.role === 'ADMIN') {
      const activeAdmins = await query('SELECT id FROM users WHERE role = $1 AND "isActive" = true AND "archivedAt" IS NULL FOR UPDATE', ['ADMIN']);
      if (activeAdmins.rowCount <= 1) return false;
    }

    if (actor.role === 'JOB_SEEKER') {
      const profile = await query('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [actor.userId]);
      if (profile.rowCount > 0) {
        const profileId = profile.rows[0].id;
        await query('DELETE FROM saved_jobs WHERE "jobSeekerId" = $1', [profileId]);
        await query('DELETE FROM job_applications WHERE "jobSeekerId" = $1', [profileId]);
        await query('DELETE FROM skill_gap_results WHERE "jobSeekerId" = $1', [profileId]);
        await query('DELETE FROM job_seeker_skills WHERE "jobSeekerId" = $1', [profileId]);
        await query('DELETE FROM employer_feedbacks WHERE "jobSeekerId" = $1', [profileId]);
        await query('DELETE FROM job_seeker_profiles WHERE id = $1', [profileId]);
      }
    } else if (actor.role === 'EMPLOYER') {
      const employer = await query('SELECT id FROM employer_profiles WHERE "userId" = $1', [actor.userId]);
      if (employer.rowCount > 0) {
        const employerId = employer.rows[0].id;
        await query('DELETE FROM employer_feedbacks WHERE "employerId" = $1', [employerId]);
        await query('DELETE FROM employer_verification_records WHERE "employerId" = $1', [employerId]);
        const jobs = await query('SELECT id FROM jobs WHERE "employerId" = $1', [employerId]);
        for (const job of jobs.rows) {
          await query('DELETE FROM job_applications WHERE "jobId" = $1', [job.id]);
          await query('DELETE FROM job_skill_requirements WHERE "jobId" = $1', [job.id]);
        }
        await query('DELETE FROM jobs WHERE "employerId" = $1', [employerId]);
        await query('DELETE FROM employer_profiles WHERE id = $1', [employerId]);
      }
    }

    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, actor.userId, 'USER_ACCOUNT_DELETED', 'User', actor.userId, `Account deleted by user: ${actor.email}`]
    );
    await query('DELETE FROM users WHERE id = $1', [actor.userId]);
    return true;
  });
}
