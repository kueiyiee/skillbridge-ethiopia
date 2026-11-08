import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import { getLocationMatchValues } from '@/shared/ethiopiaLocations';
import { JobsError } from './jobs.errors';
import type { JobCreationInput, JobRow, JobSearchFilters, JobStatus } from './jobs.types';

export const jobsRepository = {
  async list(filters: JobSearchFilters): Promise<JobRow[]> {
    let sql = `
      SELECT j.*,
             e."companyName" AS "employerName",
             e."isApproved" AS "employerVerified",
             e.industry AS "employerIndustry",
             (SELECT count(*) FROM job_applications ja WHERE ja."jobId" = j.id AND ja."archivedAt" IS NULL) AS "applicantsCount"
      FROM jobs j
      JOIN employer_profiles e ON j."employerId" = e.id
      JOIN users u ON u.id = e."userId"
      WHERE j.status = 'ACTIVE' AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
        AND e."isApproved" = true AND u."isActive" = true AND u."archivedAt" IS NULL
        AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE)
    `;
    const params: unknown[] = [];

    if (filters.q) {
      params.push(`%${filters.q.toLowerCase()}%`);
      sql += ` AND (
        LOWER(j.title) LIKE $${params.length}
        OR LOWER(j.summary) LIKE $${params.length}
        OR LOWER(e."companyName") LIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM job_skill_requirements jsr
          JOIN skills s ON s.id = jsr."skillId"
          WHERE jsr."jobId" = j.id AND LOWER(s.name) LIKE $${params.length}
        )
      )`;
    }
    if (filters.city && filters.city !== 'All') {
      const locationMatches = getLocationMatchValues(filters.city);
      if (locationMatches.length > 0) {
        const normalizedMatches = locationMatches.map((match: string) => match.toLowerCase());
        params.push(...normalizedMatches);
        const placeholders = normalizedMatches.map((_: string, index: number) => `LOWER(COALESCE(j.city, '')) = $${params.length - normalizedMatches.length + index + 1}`).join(' OR ');
        sql += ` AND (${placeholders})`;
      } else {
        params.push(filters.city.toLowerCase());
        sql += ` AND LOWER(COALESCE(j.city, '')) = $${params.length}`;
      }
    }
    if (filters.type && filters.type !== 'All') {
      params.push(filters.type);
      sql += ` AND (j."jobType" = $${params.length} OR j."workplaceType" = $${params.length})`;
    }
    if (filters.minSalary && filters.minSalary > 0) {
      params.push(filters.minSalary);
      sql += ` AND (j."salaryMinETB" >= $${params.length} OR j."salaryMinETB" IS NULL)`;
    }

    sql += ' ORDER BY j."createdAt" DESC';
    const result = await db.query<JobRow>(sql, params);
    return result.rows;
  },

  async findByIdForViewer(jobId: string, userId: string | null, role: string | null): Promise<JobRow | undefined> {
    const result = await db.query<JobRow>(
      `SELECT j.*,
              e."companyName" AS "employerName",
              e."isApproved" AS "employerVerified",
              e.industry AS "employerIndustry",
              e.city AS "employerCity",
              (SELECT count(*) FROM job_applications ja WHERE ja."jobId" = j.id AND ja."archivedAt" IS NULL) AS "applicantsCount"
       FROM jobs j
       JOIN employer_profiles e ON j."employerId" = e.id
       JOIN users u ON u.id = e."userId"
       WHERE j.id = $1
         AND j."archivedAt" IS NULL
         AND ((j.status = 'ACTIVE' AND e."archivedAt" IS NULL AND u."isActive" = true AND u."archivedAt" IS NULL
               AND e."isApproved" = true AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE))
              OR (e."userId" = $2 AND u."isActive" = true AND u."archivedAt" IS NULL)
              OR $3 = 'ADMIN')`,
      [jobId, userId, role]
    );
    return result.rows[0];
  },

  async getSkillRequirements(jobId: string): Promise<JobRow[]> {
    const result = await db.query<JobRow>(
      `SELECT jsr.*, s.name AS "skillName", s.category
       FROM job_skill_requirements jsr
       JOIN skills s ON jsr."skillId" = s.id
       WHERE jsr."jobId" = $1`,
      [jobId]
    );
    return result.rows;
  },

  async incrementViews(jobId: string): Promise<void> {
    await db.query('UPDATE jobs SET "viewsCount" = "viewsCount" + 1 WHERE id = $1', [jobId]);
  },

  async findEmployerForUser(userId: string): Promise<JobRow | undefined> {
    const result = await db.query<JobRow>(
      'SELECT id, "companyName", industry, "isApproved" FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL',
      [userId]
    );
    return result.rows[0];
  },

  async create(jobId: string, userId: string, employerId: string, status: 'ACTIVE' | 'DRAFT', data: JobCreationInput): Promise<void> {
    const deadline = data.deadline
      ? new Date(data.deadline)
      : new Date(Date.now() + 30 * 24 * 3600 * 1000);

    await db.transaction(async ({ query }) => {
      await query(
        `INSERT INTO jobs
         (id, "employerId", title, department, "jobType", city, "workplaceType", summary,
          responsibilities, qualifications, "minExperienceYears", "salaryMinETB", "salaryMaxETB",
          "isSalaryNegotiable", status, deadline, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          jobId,
          employerId,
          data.title,
          data.department || 'Engineering',
          data.jobType,
          data.city,
          data.workplaceType,
          data.summary,
          JSON.stringify(Array.isArray(data.responsibilities) ? data.responsibilities : [data.responsibilities]),
          JSON.stringify(Array.isArray(data.qualifications) ? data.qualifications : [data.qualifications]),
          data.minExperienceYears,
          data.salaryMinETB || null,
          data.salaryMaxETB || null,
          data.isSalaryNegotiable,
          status,
          deadline,
        ]
      );

      for (const requirement of data.skillRequirements) {
        const skillResult = await query('SELECT id FROM skills WHERE id = $1', [requirement.skillId]);
        const skillId = skillResult.rows[0]?.id;
        if (!skillId) throw new JobsError('A selected skill is no longer available. Refresh the skill catalog and try again.', 400);

        await query(
          `INSERT INTO job_skill_requirements (id, "jobId", "skillId", "isMandatory", weight, "requiredLevel")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON DUPLICATE KEY UPDATE id = id`,
          [
            `req-${randomUUID()}`,
            jobId,
            skillId,
            requirement.isMandatory,
            requirement.weight,
            requirement.requiredLevel,
          ]
        );
      }

      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [`audit-${randomUUID()}`, userId, 'JOB_CREATED', 'Job', jobId, `Created vacancy: ${data.title}`]
      );
    });
  },

  async update(jobId: string, userId: string, data: JobCreationInput): Promise<void> {
    const deadline = data.deadline ? new Date(data.deadline) : null;
    await db.transaction(async ({ query }) => {
      const ownedJob = await query<{ id: string; title: string }>(
        `SELECT j.id, j.title FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
         WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL AND e."userId" = $2
         FOR UPDATE`,
        [jobId, userId],
      );
      if (!ownedJob.rows[0]) throw new JobsError('Job posting not found.', 404);

      await query(
        `UPDATE jobs SET title = $1, department = $2, "jobType" = $3, city = $4,
          "workplaceType" = $5, summary = $6, responsibilities = $7, qualifications = $8,
          "minExperienceYears" = $9, "salaryMinETB" = $10, "salaryMaxETB" = $11,
          "isSalaryNegotiable" = $12, deadline = $13, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $14`,
        [
          data.title,
          data.department || 'Engineering',
          data.jobType,
          data.city,
          data.workplaceType,
          data.summary,
          JSON.stringify(Array.isArray(data.responsibilities) ? data.responsibilities : [data.responsibilities]),
          JSON.stringify(Array.isArray(data.qualifications) ? data.qualifications : [data.qualifications]),
          data.minExperienceYears,
          data.salaryMinETB || null,
          data.salaryMaxETB || null,
          data.isSalaryNegotiable,
          deadline,
          jobId,
        ],
      );
      await query('DELETE FROM job_skill_requirements WHERE "jobId" = $1', [jobId]);
      for (const requirement of data.skillRequirements) {
        const skill = await query<{ id: string }>('SELECT id FROM skills WHERE id = $1', [requirement.skillId]);
        if (!skill.rows[0]) throw new JobsError('A selected skill is no longer available. Refresh the skill catalog and try again.', 400);
        await query(
          `INSERT INTO job_skill_requirements (id, "jobId", "skillId", "isMandatory", weight, "requiredLevel")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`req-${randomUUID()}`, jobId, skill.rows[0].id, requirement.isMandatory, requirement.weight, requirement.requiredLevel],
        );
      }
      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, 'JOB_UPDATED', 'Job', $3, $4)`,
        [`audit-${randomUUID()}`, userId, jobId, `Updated vacancy: ${data.title}`],
      );
    });
  },

  async isOwnedByEmployer(jobId: string, userId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT j.id FROM jobs j
       JOIN employer_profiles e ON j."employerId" = e.id
       WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL AND e."userId" = $2`,
      [jobId, userId]
    );
    return result.rowCount > 0;
  },

  async isExpired(jobId: string): Promise<boolean> {
    const result = await db.query<{ isExpired: boolean }>(
      'SELECT CASE WHEN deadline IS NOT NULL AND DATE(deadline) < CURRENT_DATE THEN true ELSE false END AS "isExpired" FROM jobs WHERE id = $1 AND "archivedAt" IS NULL',
      [jobId]
    );
    return Boolean(result.rows[0]?.isExpired);
  },

  async updateStatus(jobId: string, status: JobStatus, userId: string): Promise<void> {
    await db.transaction(async ({ query }) => {
      const jobResult = await query<{ id: string; title: string; employerUserId: string; status: JobStatus }>(
        `SELECT j.id, j.title, j.status, ep."userId" AS "employerUserId"
         FROM jobs j JOIN employer_profiles ep ON ep.id = j."employerId"
         WHERE j.id = $1 AND j."archivedAt" IS NULL AND ep."archivedAt" IS NULL
         FOR UPDATE`,
        [jobId],
      );
      const job = jobResult.rows[0];
      if (!job || job.employerUserId !== userId) throw new JobsError('Job posting not found.', 404);
      if (job.status === status) return;

      await query('UPDATE jobs SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2', [status, jobId]);
      if (status === 'PAUSED' || status === 'CLOSED') {
        const applicants = await query<{ applicationId: string; candidateUserId: string }>(
          `SELECT ja.id AS "applicationId", jsp."userId" AS "candidateUserId"
           FROM job_applications ja JOIN job_seeker_profiles jsp ON jsp.id = ja."jobSeekerId"
           WHERE ja."jobId" = $1 AND ja."archivedAt" IS NULL
             AND ja.status NOT IN ('REJECTED', 'WITHDRAWN', 'HIRED')
           ORDER BY ja.id`,
          [jobId],
        );
        const subject = status === 'CLOSED' ? 'Recruitment closed' : 'Recruitment temporarily paused';
        const body = status === 'CLOSED'
          ? `Recruitment for ${job.title} has closed. This role is no longer accepting applications.`
          : `Recruitment for ${job.title} is temporarily paused. We will share an update if the process resumes.`;
        for (const applicant of applicants.rows) {
          await query(
            `INSERT INTO application_messages
             (id, "applicationId", "senderUserId", "recipientUserId", kind, subject, body, "actionStatus", "createdAt")
             VALUES ($1, $2, $3, $4, 'APPLICATION_UPDATE', $5, $6, 'NONE', CURRENT_TIMESTAMP)`,
            [`msg-${randomUUID()}`, applicant.applicationId, userId, applicant.candidateUserId, subject, body],
          );
        }
      }
      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, 'JOB_STATUS_UPDATED', 'Job', $3, $4)`,
        [`audit-${randomUUID()}`, userId, jobId, `Job ${job.title} moved from ${job.status} to ${status}.`],
      );
    });
  },

  async isActiveAndVerified(jobId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT j.id FROM jobs j
       JOIN employer_profiles e ON e.id = j."employerId"
       JOIN users u ON u.id = e."userId"
       WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
         AND u."archivedAt" IS NULL AND u."isActive" = true AND j.status = 'ACTIVE' AND e."isApproved" = true
         AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE)`,
      [jobId]
    );
    return result.rowCount > 0;
  },

  async findCandidateProfile(userId: string): Promise<JobRow | undefined> {
    const result = await db.query<JobRow>(
      'SELECT p.id, u."fullName" FROM job_seeker_profiles p JOIN users u ON u.id = p."userId" WHERE p."userId" = $1 AND u."archivedAt" IS NULL AND u."isActive" = true',
      [userId]
    );
    return result.rows[0];
  },

  async hasApplied(jobId: string, profileId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT id FROM job_applications WHERE "jobId" = $1 AND "jobSeekerId" = $2 AND "archivedAt" IS NULL',
      [jobId, profileId]
    );
    return result.rowCount > 0;
  },

  async createApplication(
    applicationId: string,
    jobId: string,
    profileId: string,
    coverNote: string | undefined,
    matchResult: { overallMatchScore: number; matchedSkills: unknown[]; missingSkills: unknown[] },
  ): Promise<boolean> {
    return db.transaction(async ({ query }) => {
      await query(
        `INSERT INTO job_applications (id, "jobId", "jobSeekerId", "coverNote", status, "matchScore", "appliedAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'APPLIED', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE id = id`,
        [applicationId, jobId, profileId, coverNote || null, matchResult.overallMatchScore]
      );
      const application = await query<{ id: string }>(
        'SELECT id FROM job_applications WHERE "jobId" = $1 AND "jobSeekerId" = $2 AND "archivedAt" IS NULL',
        [jobId, profileId],
      );
      if (application.rows[0]?.id !== applicationId) return false;

      await query(
        `INSERT INTO skill_gap_results (id, "jobSeekerId", "jobId", "matchPercentage", "matchedSkillsJson", "missingSkillsJson")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `gap-${randomUUID()}`,
          profileId,
          jobId,
          matchResult.overallMatchScore,
          JSON.stringify(matchResult.matchedSkills),
          JSON.stringify(matchResult.missingSkills),
        ]
      );
      return true;
    });
  },

  async save(jobId: string, profileId: string): Promise<void> {
    await db.query(
      `INSERT INTO saved_jobs (id, "jobSeekerId", "jobId", "savedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE id = id`,
      [`saved-${randomUUID()}`, profileId, jobId]
    );
  },

  async removeSaved(jobId: string, profileId: string): Promise<void> {
    await db.query('DELETE FROM saved_jobs WHERE "jobSeekerId" = $1 AND "jobId" = $2', [profileId, jobId]);
  },

  async findCandidateId(userId: string): Promise<string | undefined> {
    const result = await db.query<{ id: string }>(
      'SELECT id FROM job_seeker_profiles WHERE "userId" = $1',
      [userId]
    );
    return result.rows[0]?.id;
  },
};
