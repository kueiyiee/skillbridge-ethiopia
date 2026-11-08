import { db } from '../../infrastructure/database/drizzle';
import { randomUUID } from 'node:crypto';
import type { AuthActor } from '../auth/auth.types';
import type { ProfileUpdateInput } from './profile.types';

export async function getAccountProfile(actor: AuthActor) {
  const result = await db.query<Record<string, any>>(
    `SELECT id, email, username, "fullName", "middleName", phone, "avatarUrl", "coverUrl", "dateOfBirth", gender,
            country, region, "preferredLanguage", "profileVisibility", "showPhone", "showEmail", "showLocation",
            "showGender", "candidateSearchable", "employerDiscoverable", "createdAt"
     FROM users WHERE id = $1 AND "isActive" = true AND "archivedAt" IS NULL LIMIT 1`,
    [actor.userId]
  );
  const user = result.rows[0];
  if (!user) return null;

  let roleProfile: Record<string, unknown> = {};
  if (actor.role === 'JOB_SEEKER') {
    const profile = await db.query<Record<string, unknown>>(
      `SELECT headline, bio, city, "portfolioUrl", "linkedinUrl"
       FROM job_seeker_profiles WHERE "userId" = $1 LIMIT 1`,
      [actor.userId]
    );
    roleProfile = profile.rows[0] || {};
  } else if (actor.role === 'EMPLOYER') {
    const profile = await db.query<Record<string, unknown>>(
      `SELECT "companyName", industry, city, website, "companyOverview", "logoUrl", "isApproved", "employeeRange"
       FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL LIMIT 1`,
      [actor.userId]
    );
    roleProfile = profile.rows[0] || {};
  }

  const nameParts = String(user.fullName || '').trim().split(/\s+/).filter(Boolean);
  const storedGender = String(user.gender || '');
  const selfDescribed = storedGender.startsWith('SELF_DESCRIBED:');
  return {
    user: {
      ...user,
      showPhone: Boolean(user.showPhone),
      showEmail: Boolean(user.showEmail),
      showLocation: Boolean(user.showLocation),
      showGender: Boolean(user.showGender),
      candidateSearchable: Boolean(user.candidateSearchable),
      employerDiscoverable: Boolean(user.employerDiscoverable),
      firstName: nameParts[0] || '',
      middleName: user.middleName || '',
      lastName: nameParts.length > 1 ? nameParts.slice(1).filter((part) => part !== user.middleName).join(' ') : '',
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
      gender: selfDescribed ? 'SELF_DESCRIBED' : storedGender,
      genderDescription: selfDescribed ? storedGender.slice('SELF_DESCRIBED:'.length) : '',
    },
    role: actor.role,
    roleProfile,
  };
}

export class ProfileConflictError extends Error {}

export async function updateAccountProfile(actor: AuthActor, input: ProfileUpdateInput): Promise<void> {
  const username = input.username?.trim().toLowerCase() || null;
  if (username) {
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1',
      [username, actor.userId]
    );
    if (existing.rowCount) throw new ProfileConflictError('That username is already in use.');
  }

  const fullName = [input.firstName, input.middleName, input.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
  const gender = input.gender === 'SELF_DESCRIBED'
    ? `SELF_DESCRIBED:${input.genderDescription?.trim() || ''}`
    : input.gender || null;

  await db.transaction(async ({ query }) => {
    await query(
      `UPDATE users SET username = $1, "fullName" = $2, "middleName" = $3, phone = $4, "dateOfBirth" = $5,
       gender = $6, country = $7, region = $8, "preferredLanguage" = $9, "profileVisibility" = $10,
       "showPhone" = $11, "showEmail" = $12, "showLocation" = $13, "showGender" = $14,
       "candidateSearchable" = $15, "employerDiscoverable" = $16, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $17`,
      [username, fullName, input.middleName?.trim() || null, input.phone?.trim() || null, input.dateOfBirth || null,
        gender, input.country?.trim() || null, input.region?.trim() || null, input.preferredLanguage,
        input.profileVisibility, input.showPhone, input.showEmail, input.showLocation, input.showGender,
        actor.role === 'JOB_SEEKER' && input.candidateSearchable,
        actor.role === 'JOB_SEEKER' && input.employerDiscoverable, actor.userId]
    );

    if (actor.role === 'JOB_SEEKER') {
      await query(
        `UPDATE job_seeker_profiles SET headline = $1, bio = $2, city = $3, "portfolioUrl" = $4,
         "linkedinUrl" = $5, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $6`,
        [input.headline?.trim() || null, input.bio?.trim() || null, input.city?.trim() || 'Addis Ababa',
          input.portfolioUrl || null, input.linkedinUrl || null, actor.userId]
      );
    } else if (actor.role === 'EMPLOYER') {
      const existing = await query<{ id: string; companyName: string; industry: string; isApproved: boolean }>(
        'SELECT id, "companyName", industry, "isApproved" FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL FOR UPDATE',
        [actor.userId]
      );
      const current = existing.rows[0];
      if (current) {
        const changedFields = [
          input.companyName?.trim() && input.companyName.trim() !== current.companyName ? 'company name' : null,
          input.industry?.trim() && input.industry.trim() !== current.industry ? 'industry' : null,
        ].filter((field): field is string => field !== null);
        const identityChanged = changedFields.length > 0;
        await query(
          `UPDATE employer_profiles SET "companyName" = COALESCE($1, "companyName"),
           industry = COALESCE($2, industry), "employeeRange" = COALESCE($3, "employeeRange"),
           city = $4, website = $5, "companyOverview" = $6,
           "isApproved" = CASE WHEN $7 THEN false ELSE "isApproved" END,
           "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $8`,
          [
            input.companyName?.trim() || null,
            input.industry?.trim() || null,
            input.employeeRange?.trim() || null,
            input.city?.trim() || 'Addis Ababa',
            input.website || null,
            input.bio?.trim() || null,
            identityChanged,
            actor.userId,
          ]
        );
        if (identityChanged) {
          await query(
            `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
             VALUES ($1, $2, 'EMPLOYER_PROFILE_UPDATED', 'EmployerProfile', $3, $4)`,
            [
              `audit-${randomUUID()}`,
              actor.userId,
              current.id,
              `${changedFields.join(' and ')} changed${current.isApproved ? '; verification revoked pending resubmission' : ''}.`,
            ]
          );
        }
      }
    }
  });
}

export async function updateProfileImage(userId: string, kind: 'avatar' | 'cover', url: string): Promise<void> {
  const column = kind === 'avatar' ? '"avatarUrl"' : '"coverUrl"';
  await db.query(`UPDATE users SET ${column} = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`, [url, userId]);
}

export async function removeProfileImage(userId: string, kind: 'avatar' | 'cover'): Promise<string | null> {
  const column = kind === 'avatar' ? '"avatarUrl"' : '"coverUrl"';
  const result = await db.query<{ imageUrl: string | null }>(`SELECT ${column} AS "imageUrl" FROM users WHERE id = $1`, [userId]);
  await db.query(`UPDATE users SET ${column} = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
  return result.rows[0]?.imageUrl || null;
}