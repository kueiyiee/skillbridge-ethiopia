import { db } from '../../infrastructure/database/drizzle';
import type { AiActor, AiRow } from './ai-nexus.types';

const skillCatalogTtlMs = 30_000;
let skillCatalogCache: { expiresAt: number; rows: AiRow[] } | undefined;

async function getCachedSkillCatalog(limit: number): Promise<AiRow[]> {
  if (!skillCatalogCache || skillCatalogCache.expiresAt <= Date.now()) {
    const result = await db.query<AiRow>(
      `SELECT name, category, "demandRating" FROM skills ORDER BY "demandRating" DESC, name ASC LIMIT 100`
    );
    skillCatalogCache = { expiresAt: Date.now() + skillCatalogTtlMs, rows: result.rows };
  }
  return skillCatalogCache.rows.slice(0, limit).map((skill) => ({ ...skill }));
}

export async function listSkillCatalog(): Promise<AiRow[]> {
  return getCachedSkillCatalog(100);
}

export async function listConversations(actor: AiActor): Promise<AiRow[]> {
  const result = await db.query<AiRow>(
    `SELECT c.*,
            (SELECT count(*) FROM ai_nexus_messages m WHERE m."conversationId" = c.id) AS "messageCount",
            (SELECT m.content FROM ai_nexus_messages m WHERE m."conversationId" = c.id ORDER BY m."createdAt" DESC LIMIT 1) AS "lastMessage"
     FROM ai_nexus_conversations c WHERE c."userId" = $1 AND c.role = $2
     ORDER BY c."updatedAt" DESC LIMIT 20`,
    [actor.userId, actor.role]
  );
  return result.rows;
}

export async function findOwnedConversation(conversationId: string, actor: AiActor): Promise<AiRow | undefined> {
  const result = await db.query<AiRow>(
    'SELECT * FROM ai_nexus_conversations WHERE id = $1 AND "userId" = $2 AND role = $3',
    [conversationId, actor.userId, actor.role]
  );
  return result.rows[0];
}

export async function listConversationMessages(conversationId: string): Promise<AiRow[]> {
  const result = await db.query<AiRow>('SELECT * FROM ai_nexus_messages WHERE "conversationId" = $1 ORDER BY "createdAt" ASC', [conversationId]);
  return result.rows;
}

export async function listRecentConversationMessages(
  conversationId: string,
  limit = 6,
  excludedUserMetadata?: string,
): Promise<AiRow[]> {
  const boundedLimit = Math.max(1, Math.min(6, Math.trunc(limit)));
  const excludeCurrentTurn = excludedUserMetadata !== undefined;
  const result = await db.query<AiRow>(
    `SELECT sender, content FROM ai_nexus_messages WHERE "conversationId" = $1
     ${excludeCurrentTurn ? 'AND NOT (sender = \'user\' AND metadata = $3)' : ''}
     ORDER BY "createdAt" DESC LIMIT $2`,
    excludeCurrentTurn ? [conversationId, boundedLimit, excludedUserMetadata] : [conversationId, boundedLimit],
  );
  return result.rows.reverse();
}

export async function createConversation(actor: AiActor, conversationId: string, title: string, contextRoute: string): Promise<void> {
  await db.query(
    `INSERT INTO ai_nexus_conversations (id, "userId", role, title, "contextRoute", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [conversationId, actor.userId, actor.role, title, contextRoute]
  );
}

export async function saveMessage(
  messageId: string,
  conversationId: string,
  sender: 'user' | 'assistant',
  content: string,
  isAiGenerated: boolean,
  metadata?: unknown,
  idempotent = false,
): Promise<void> {
  await db.query(
    `INSERT INTO ai_nexus_messages (id, "conversationId", sender, content, "isAiGenerated", metadata, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ${idempotent ? 'ON DUPLICATE KEY UPDATE id = id' : ''}`,
    [messageId, conversationId, sender, content, isAiGenerated, metadata == null ? null : JSON.stringify(metadata)]
  );
}

export async function updateConversationTimestamp(conversationId: string): Promise<void> {
  await db.query('UPDATE ai_nexus_conversations SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);
}

export async function deleteConversation(conversationId: string, actor: AiActor): Promise<void> {
  await db.query(
    'DELETE FROM ai_nexus_conversations WHERE id = $1 AND "userId" = $2 AND role = $3',
    [conversationId, actor.userId, actor.role]
  );
}

export async function getRoleContext(actor: AiActor, selectedJobId?: string) {
  if (actor.role === 'JOB_SEEKER') {
    const profileResult = await db.query<AiRow>(
      `SELECT p.id, p.headline, p."experienceYears", p."educationLevel", p."desiredRole"
       FROM job_seeker_profiles p WHERE p."userId" = $1`,
      [actor.userId]
    );
    const profile = profileResult.rows[0] ?? null;
    const [skillsResult, applicationsResult, jobs, selectedJobResult, catalogSkills] = await Promise.all([
      profile ? db.query<AiRow>(
        `SELECT jsk."proficiencyLevel", jsk."yearsExperience", jsk."isVerified", s.name AS "skillName", s.category, s."demandRating"
         FROM job_seeker_skills jsk JOIN skills s ON jsk."skillId" = s.id WHERE jsk."jobSeekerId" = $1`,
        [profile.id]
      ) : Promise.resolve({ rows: [] as AiRow[], rowCount: 0 }),
      profile ? db.query<AiRow>(
        `SELECT ja.id, ja.status, ja."matchScore", ja."appliedAt", j.title AS "jobTitle", e."companyName" AS "employerName"
         FROM job_applications ja JOIN jobs j ON ja."jobId" = j.id
         JOIN employer_profiles e ON j."employerId" = e.id WHERE ja."jobSeekerId" = $1
           AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
         ORDER BY ja."appliedAt" DESC LIMIT 5`,
        [profile.id]
      ) : Promise.resolve({ rows: [] as AiRow[], rowCount: 0 }),
      db.query<AiRow>(
        `SELECT j.id, j.title, j.city, j."workplaceType", j."salaryMinETB", j."salaryMaxETB", e."companyName" AS "employerName"
         FROM jobs j JOIN employer_profiles e ON j."employerId" = e.id
         WHERE j.status = 'ACTIVE' AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
           AND e."isApproved" = true ORDER BY j."createdAt" DESC LIMIT 6`
      ),
      selectedJobId ? db.query<AiRow>(
        `SELECT j.*, e."companyName" FROM jobs j JOIN employer_profiles e ON j."employerId" = e.id
         WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
           AND j.status = 'ACTIVE' AND e."isApproved" = true`,
        [selectedJobId]
      ) : Promise.resolve({ rows: [] as AiRow[], rowCount: 0 }),
      getCachedSkillCatalog(12),
    ]);
    return {
      profile,
      skills: skillsResult.rows,
      applications: applicationsResult.rows,
      jobs: jobs.rows,
      selectedJob: selectedJobResult.rows[0] ?? null,
      catalogSkills,
    };
  }

  if (actor.role === 'EMPLOYER') {
    const employerResult = await db.query<AiRow>('SELECT id, "companyName", industry, "isApproved" FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL', [actor.userId]);
    const employer = employerResult.rows[0] ?? null;
    if (!employer) return { employer: null, jobs: [], applicants: [], evaluations: [] };
    const [jobs, applicants, evaluations] = await Promise.all([
      db.query<AiRow>(
        `SELECT j.id, j.title, j.status, j."createdAt", (SELECT count(*) FROM job_applications ja WHERE ja."jobId" = j.id AND ja."archivedAt" IS NULL) AS "applicantsCount"
         FROM jobs j WHERE j."employerId" = $1 AND j."archivedAt" IS NULL ORDER BY j."createdAt" DESC LIMIT 8`, [employer.id]
      ),
      db.query<AiRow>(
        `SELECT ja."matchScore", ja.status, ja."appliedAt", j.title AS "jobTitle"
         FROM job_applications ja JOIN jobs j ON ja."jobId" = j.id
         WHERE j."employerId" = $1 AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL ORDER BY ja."appliedAt" DESC LIMIT 8`, [employer.id]
      ),
      db.query<AiRow>(
        `SELECT ef.period, ef."overallScore", ef."retentionRecommendation", j.title AS "jobTitle"
         FROM employer_feedbacks ef JOIN jobs j ON ef."jobId" = j.id
         WHERE ef."employerId" = $1 AND j."archivedAt" IS NULL ORDER BY ef."createdAt" DESC LIMIT 5`, [employer.id]
      ),
    ]);
    return { employer, jobs: jobs.rows, applicants: applicants.rows, evaluations: evaluations.rows };
  }

  const [pendingVerifications, users, jobs, applications, auditLogs] = await Promise.all([
    db.query('SELECT count(*) AS count FROM employer_verification_records WHERE status = \'PENDING\' AND "archivedAt" IS NULL'),
    db.query('SELECT count(*) AS count FROM users WHERE "isActive" = true AND "archivedAt" IS NULL'),
    db.query("SELECT count(*) AS count FROM jobs WHERE status = 'ACTIVE' AND \"archivedAt\" IS NULL"),
    db.query('SELECT count(*) AS count FROM job_applications WHERE "archivedAt" IS NULL'),
    db.query<AiRow>('SELECT action, "entityType", "createdAt" FROM platform_audit_logs ORDER BY "createdAt" DESC LIMIT 6'),
  ]);
  return { pendingVerifications: pendingVerifications.rows[0], users: users.rows[0], jobs: jobs.rows[0], applications: applications.rows[0], auditLogs: auditLogs.rows };
}

export async function getSkillAdvisorContext(userId: string, jobId?: string) {
  const [profileResult, catalogSkills] = await Promise.all([
    db.query<AiRow>(
      `SELECT p.id, p.headline, p."experienceYears", p."educationLevel", p."desiredRole"
       FROM job_seeker_profiles p WHERE p."userId" = $1`,
      [userId]
    ),
    getCachedSkillCatalog(40),
  ]);
  const profile = profileResult.rows[0];
  if (!profile) return undefined;

  const [skillsResult, jobResult] = await Promise.all([
    db.query<AiRow>(
      `SELECT jsk."skillId", jsk."proficiencyLevel", jsk."yearsExperience", jsk."isVerified", s.name AS "skillName", s.category, s."demandRating"
       FROM job_seeker_skills jsk JOIN skills s ON s.id = jsk."skillId" WHERE jsk."jobSeekerId" = $1`,
      [profile.id]
    ),
    jobId ? db.query<AiRow>(
      `SELECT j.id, j.title FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
       WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
         AND j.status = 'ACTIVE' AND e."isApproved" = true`,
      [jobId]
    ) : Promise.resolve({ rows: [] as AiRow[], rowCount: 0 }),
  ]);
  const job = jobResult.rows[0];
  const requirementsResult = job ? await db.query<AiRow>(
    `SELECT s.name AS skill, req.weight, req."isMandatory", req."requiredLevel", jsk."proficiencyLevel" AS "candidateLevel"
     FROM job_skill_requirements req JOIN skills s ON s.id = req."skillId"
     LEFT JOIN job_seeker_skills jsk ON jsk."skillId" = req."skillId" AND jsk."jobSeekerId" = $2
     WHERE req."jobId" = $1`,
    [jobId, profile.id]
  ) : { rows: [] as AiRow[] };
  return { profile, skills: skillsResult.rows, job, requirements: requirementsResult.rows, catalogSkills };
}
