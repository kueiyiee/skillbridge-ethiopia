import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import { assertApplicationManaged, assertApplicationStatusTransition, assertEmployerIsVerified, assertNoPendingVerification } from './employers.policy';
import type {
  ApplicationStatusInput,
  CandidateSearchInput,
  EmployerActor,
  EmployerReportQuery,
  EmployerReportType,
  EmployerRow,
  VerificationSubmissionInput,
} from './employers.types';
import type { ApplicationStatus } from '../../../../shared/types';

export async function listPublicEmployers(): Promise<EmployerRow[]> {
  const result = await db.query<EmployerRow>(
    `SELECT e.id, e."companyName", e.industry, e.city, e.website, e."employeeRange",
            e."companyOverview", e."logoUrl", e."isApproved",
            (SELECT count(*) FROM jobs j WHERE j."employerId" = e.id AND j."archivedAt" IS NULL AND j.status = 'ACTIVE'
              AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE)) AS "activeJobsCount"
     FROM employer_profiles e
     JOIN users u ON u.id = e."userId"
     WHERE e."archivedAt" IS NULL AND u."archivedAt" IS NULL AND u."isActive" = true
       AND e."isApproved" = true ORDER BY e."companyName" ASC`
  );
  return result.rows;
}

export async function findEmployer(userId: string): Promise<EmployerRow | undefined> {
  const result = await db.query<EmployerRow>('SELECT * FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL', [userId]);
  return result.rows[0];
}

export async function getLatestVerification(employerId: string): Promise<EmployerRow | undefined> {
  const result = await db.query<EmployerRow>(
    `SELECT id, "employerId", "tinNumber", "businessLicenseNo", status, "reviewNotes",
      "reviewerAdminId", "reviewedAt", "createdAt", "updatedAt"
     FROM employer_verification_records
     WHERE "employerId" = $1 AND "archivedAt" IS NULL
     ORDER BY "createdAt" DESC, id DESC LIMIT 1`,
    [employerId]
  );
  return result.rows[0];
}

export async function listEmployerJobs(employerId: string): Promise<EmployerRow[]> {
  const result = await db.query<EmployerRow>(
    `SELECT j.*,
       CASE WHEN j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE
         THEN 'EXPIRED' ELSE j.status END AS "effectiveStatus",
       (SELECT count(*) FROM job_applications ja WHERE ja."jobId" = j.id AND ja."archivedAt" IS NULL) AS "applicantsCount"
     FROM jobs j WHERE j."employerId" = $1 AND j."archivedAt" IS NULL ORDER BY j."createdAt" DESC`,
    [employerId]
  );
  return result.rows;
}

export async function submitVerification(
  recordId: string,
  actor: EmployerActor,
  employerId: string,
  input: VerificationSubmissionInput,
): Promise<void> {
  await db.transaction(async ({ query }) => {
    await query('SELECT id FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NULL FOR UPDATE', [employerId]);
    const pending = await query(
      'SELECT id FROM employer_verification_records WHERE "employerId" = $1 AND "archivedAt" IS NULL AND status = $2 LIMIT 1',
      [employerId, 'PENDING']
    );
    assertNoPendingVerification(pending.rowCount > 0);

    await query(
      `INSERT INTO employer_verification_records
       (id, "employerId", "tinNumber", "businessLicenseNo", "documentUrl", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NULL, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [recordId, employerId, input.tinNumber, input.businessLicenseNo]
    );
    await query(
      'UPDATE employer_profiles SET "tinNumber" = $1, "businessLicenseNo" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3',
      [input.tinNumber, input.businessLicenseNo, employerId]
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, actor.userId, 'VERIFICATION_SUBMITTED', 'EmployerVerificationRecord', recordId, 'Business credentials submitted for review.']
    );
  });
}

export async function listApplicationsForEmployer(employerId: string): Promise<EmployerRow[]> {
  const result = await db.query<EmployerRow>(
        `SELECT ja.id, ja."jobId", ja."coverNote", ja.status, ja."matchScore", ja."appliedAt", ja."updatedAt",
          j.title AS "jobTitle", u."fullName" AS "candidateName",
          CASE WHEN u."showEmail" = true AND u."profileVisibility" <> 'PRIVATE' THEN u.email ELSE NULL END AS "candidateEmail",
          CASE WHEN u."showPhone" = true AND u."profileVisibility" <> 'PRIVATE' THEN u.phone ELSE NULL END AS "candidatePhone",
          u."profileVisibility" AS "candidateProfileVisibility",
          CASE WHEN u."profileVisibility" <> 'PRIVATE' THEN p.headline ELSE NULL END AS "candidateHeadline",
          CASE WHEN u."showLocation" = true AND u."profileVisibility" <> 'PRIVATE' THEN p.city ELSE NULL END AS "candidateCity",
          CASE WHEN u."profileVisibility" <> 'PRIVATE' THEN p."educationLevel" ELSE NULL END AS "candidateEducation",
          CASE WHEN u."profileVisibility" <> 'PRIVATE' THEN p."experienceYears" ELSE NULL END AS "candidateExperienceYears",
          CASE WHEN u."profileVisibility" <> 'PRIVATE' THEN
            (SELECT GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ')
             FROM job_seeker_skills jsk JOIN skills s ON s.id = jsk."skillId"
             WHERE jsk."jobSeekerId" = p.id)
            ELSE NULL END AS "candidateSkills",
          (SELECT MAX(m."createdAt") FROM application_messages m WHERE m."applicationId" = ja.id) AS "lastCommunicationAt",
          (SELECT MAX(m."dueAt") FROM application_messages m
           WHERE m."applicationId" = ja.id AND m.kind = 'INTERVIEW_INVITATION'
             AND m."actionStatus" = 'PENDING' AND m."dueAt" >= CURRENT_TIMESTAMP) AS "nextInterviewAt"
     FROM job_applications ja JOIN jobs j ON ja."jobId" = j.id
     JOIN job_seeker_profiles p ON ja."jobSeekerId" = p.id JOIN users u ON p."userId" = u.id
     WHERE j."employerId" = $1 AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL ORDER BY ja."appliedAt" DESC`,
    [employerId]
  );
  return result.rows;
}

export function buildCandidateDiscoveryFilters(filters: CandidateSearchInput, firstParameterIndex = 1) {
  const conditions = [
    `u.role = 'JOB_SEEKER'`,
    `u."isActive" = true`,
    `u."emailVerified" = true`,
    `u."archivedAt" IS NULL`,
    `u."candidateSearchable" = true`,
    `u."employerDiscoverable" = true`,
    `u."profileVisibility" IN ('REGISTERED', 'PUBLIC')`,
  ];
  const params: unknown[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${firstParameterIndex + params.length - 1}`;
  };

  if (filters.q) {
    const query = bind(filters.q.toLocaleLowerCase());
    conditions.push(`(
      LOCATE(${query}, LOWER(COALESCE(p.headline, ''))) > 0
      OR LOCATE(${query}, LOWER(COALESCE(p."desiredRole", ''))) > 0
      OR EXISTS (
        SELECT 1 FROM job_seeker_skills qjsk
        JOIN skills qs ON qs.id = qjsk."skillId"
        WHERE qjsk."jobSeekerId" = p.id AND LOCATE(${query}, LOWER(qs.name)) > 0
      )
    )`);
  }
  if (filters.skill) {
    const skill = bind(filters.skill.toLocaleLowerCase());
    conditions.push(`EXISTS (
      SELECT 1 FROM job_seeker_skills sjsk
      JOIN skills ss ON ss.id = sjsk."skillId"
      WHERE sjsk."jobSeekerId" = p.id AND LOCATE(${skill}, LOWER(ss.name)) > 0
    )`);
  }
  if (filters.location) {
    const location = bind(filters.location.toLocaleLowerCase());
    conditions.push(`u."showLocation" = true AND (
      LOCATE(${location}, LOWER(p.city)) > 0
      OR LOCATE(${location}, LOWER(COALESCE(p."subCity", ''))) > 0
      OR LOCATE(${location}, LOWER(COALESCE(u.region, ''))) > 0
    )`);
  }
  if (filters.minExperience !== undefined) {
    conditions.push(`p."experienceYears" >= ${bind(filters.minExperience)}`);
  }
  if (filters.availability) {
    conditions.push(`p."availableForWork" = ${bind(filters.availability === 'available')}`);
  }
  return { sql: conditions.join(' AND '), params };
}

function buildCandidateDiscoveryOrder(filters: CandidateSearchInput, params: unknown[]) {
  if (filters.sort === 'experience') return 'p."experienceYears" DESC, p."updatedAt" DESC, p.id ASC';
  if (filters.sort === 'recent') return 'p."updatedAt" DESC, p.id ASC';
  if (!filters.q) return 'p."updatedAt" DESC, p.id ASC';

  params.push(filters.q.toLocaleLowerCase());
  const query = `$${params.length}`;
  return `CASE
    WHEN LOCATE(${query}, LOWER(COALESCE(p.headline, ''))) > 0 THEN 0
    WHEN LOCATE(${query}, LOWER(COALESCE(p."desiredRole", ''))) > 0 THEN 1
    ELSE 2
  END, p."updatedAt" DESC, p.id ASC`;
}

export async function searchDiscoverableCandidates(employerUserId: string, filters: CandidateSearchInput) {
  const where = buildCandidateDiscoveryFilters(filters, 2);
  const countParams = [employerUserId, ...where.params];
  const countResult = await db.query<{ total: number | string }>(
    `SELECT COUNT(*) AS total
     FROM job_seeker_profiles p
     JOIN users u ON u.id = p."userId"
     JOIN employer_profiles e ON e."userId" = $1 AND e."isApproved" = true AND e."archivedAt" IS NULL
     WHERE ${where.sql}`,
    countParams,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const pageParams = [employerUserId, ...where.params];
  const orderBy = buildCandidateDiscoveryOrder(filters, pageParams);
  const limitIndex = pageParams.length + 1;
  const offsetIndex = pageParams.length + 2;
  pageParams.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
  const pageResult = await db.query<EmployerRow>(
    `SELECT p.id AS "profileId", u."fullName", p.headline, p."desiredRole",
            p."experienceYears" AS "experienceYears",
            CASE WHEN u."showLocation" = true THEN p.city ELSE NULL END AS city,
            p."availableForWork" AS "availableForWork",
            (SELECT ja.id
             FROM job_applications ja
             JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
             WHERE ja."jobSeekerId" = p.id AND j."employerId" = e.id AND ja."archivedAt" IS NULL
             ORDER BY ja."appliedAt" DESC LIMIT 1) AS "applicationId"
     FROM job_seeker_profiles p
     JOIN users u ON u.id = p."userId"
     JOIN employer_profiles e ON e."userId" = $1 AND e."isApproved" = true AND e."archivedAt" IS NULL
     WHERE ${where.sql}
     ORDER BY ${orderBy}
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    pageParams,
  );

  const profileIds = pageResult.rows.map((candidate) => String(candidate.profileId));
  const skillsByProfile = new Map<string, Array<{ name: string; proficiencyLevel: string; yearsExperience: number; isVerified: boolean }>>();
  if (profileIds.length) {
    const placeholders = profileIds.map((_id, index) => `$${index + 1}`).join(', ');
    const skillResult = await db.query<EmployerRow>(
      `SELECT jsk."jobSeekerId" AS "profileId", s.name, jsk."proficiencyLevel",
              jsk."yearsExperience", jsk."isVerified"
       FROM job_seeker_skills jsk JOIN skills s ON s.id = jsk."skillId"
       WHERE jsk."jobSeekerId" IN (${placeholders})
       ORDER BY s.name ASC`,
      profileIds,
    );
    for (const skill of skillResult.rows) {
      const profileId = String(skill.profileId);
      const profileSkills = skillsByProfile.get(profileId) || [];
      profileSkills.push({
        name: String(skill.name),
        proficiencyLevel: String(skill.proficiencyLevel),
        yearsExperience: Number(skill.yearsExperience),
        isVerified: Boolean(skill.isVerified),
      });
      skillsByProfile.set(profileId, profileSkills);
    }
  }

  return {
    candidates: pageResult.rows.map((candidate) => ({
      profileId: String(candidate.profileId),
      fullName: String(candidate.fullName),
      headline: candidate.headline ? String(candidate.headline) : null,
      desiredRole: candidate.desiredRole ? String(candidate.desiredRole) : null,
      experienceYears: Number(candidate.experienceYears),
      city: candidate.city ? String(candidate.city) : null,
      availableForWork: Boolean(candidate.availableForWork),
      skills: skillsByProfile.get(String(candidate.profileId)) || [],
      applicationId: candidate.applicationId ? String(candidate.applicationId) : null,
    })),
    total,
  };
}

export async function getDiscoverableCandidateDetails(employerUserId: string, profileId: string) {
  const result = await db.query<EmployerRow>(
    `SELECT p.id AS "profileId", u."fullName", p.headline, p."desiredRole", p.bio,
            p."experienceYears" AS "experienceYears", p."educationLevel", p."institutionName",
            CASE WHEN u."showLocation" = true THEN p.city ELSE NULL END AS city,
            p."availableForWork" AS "availableForWork",
            CASE WHEN u."showPhone" = true THEN u.phone ELSE NULL END AS phone,
            CASE WHEN u."showEmail" = true THEN u.email ELSE NULL END AS email,
            CASE WHEN u."showGender" = true THEN u.gender ELSE NULL END AS gender,
            p."portfolioUrl", p."linkedinUrl", p."githubUrl",
            (SELECT ja.id
             FROM job_applications ja
             JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
             WHERE ja."jobSeekerId" = p.id AND j."employerId" = e.id AND ja."archivedAt" IS NULL
             ORDER BY ja."appliedAt" DESC LIMIT 1) AS "applicationId"
     FROM job_seeker_profiles p
     JOIN users u ON u.id = p."userId"
     JOIN employer_profiles e ON e."userId" = $1 AND e."isApproved" = true AND e."archivedAt" IS NULL
     WHERE p.id = $2 AND u.role = 'JOB_SEEKER' AND u."isActive" = true AND u."emailVerified" = true
       AND u."archivedAt" IS NULL AND u."candidateSearchable" = true AND u."employerDiscoverable" = true
       AND u."profileVisibility" IN ('REGISTERED', 'PUBLIC')
     LIMIT 1`,
    [employerUserId, profileId],
  );
  const candidate = result.rows[0];
  if (!candidate) return undefined;

  const skills = await db.query<EmployerRow>(
    `SELECT s.name, s.category, jsk."proficiencyLevel", jsk."yearsExperience", jsk."isVerified"
     FROM job_seeker_skills jsk JOIN skills s ON s.id = jsk."skillId"
     WHERE jsk."jobSeekerId" = $1 ORDER BY s.name ASC`,
    [profileId],
  );
  return {
    profileId: String(candidate.profileId),
    fullName: String(candidate.fullName),
    headline: candidate.headline ? String(candidate.headline) : null,
    desiredRole: candidate.desiredRole ? String(candidate.desiredRole) : null,
    bio: candidate.bio ? String(candidate.bio) : null,
    experienceYears: Number(candidate.experienceYears),
    educationLevel: candidate.educationLevel ? String(candidate.educationLevel) : null,
    institutionName: candidate.institutionName ? String(candidate.institutionName) : null,
    city: candidate.city ? String(candidate.city) : null,
    availableForWork: Boolean(candidate.availableForWork),
    phone: candidate.phone ? String(candidate.phone) : null,
    email: candidate.email ? String(candidate.email) : null,
    gender: candidate.gender ? String(candidate.gender) : null,
    portfolioUrl: candidate.portfolioUrl ? String(candidate.portfolioUrl) : null,
    linkedinUrl: candidate.linkedinUrl ? String(candidate.linkedinUrl) : null,
    githubUrl: candidate.githubUrl ? String(candidate.githubUrl) : null,
    applicationId: candidate.applicationId ? String(candidate.applicationId) : null,
    skills: skills.rows.map((skill) => ({
      name: String(skill.name),
      category: String(skill.category),
      proficiencyLevel: String(skill.proficiencyLevel),
      yearsExperience: Number(skill.yearsExperience),
      isVerified: Boolean(skill.isVerified),
    })),
  };
}

const EMPLOYER_REPORT_ROW_LIMIT = 5000;
const employerApplicationStatuses = [
  'APPLIED',
  'SCREENING',
  'SHORTLISTED',
  'TECHNICAL_ASSESSMENT',
  'INTERVIEW_SCHEDULED',
  'OFFERED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
] as const;

function employerReportPeriodWhere(filters: EmployerReportQuery, alias: string, params: unknown[]) {
  const conditions = [`${alias}."archivedAt" IS NULL`];
  if (filters.startDate) {
    params.push(filters.startDate);
    conditions.push(`${alias}."appliedAt" >= $${params.length + 1}`);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    conditions.push(`${alias}."appliedAt" < DATE_ADD($${params.length + 1}, INTERVAL 1 DAY)`);
  }
  return conditions.join(' AND ');
}

function employerReportSql(type: EmployerReportType, filters: EmployerReportQuery) {
  const whereParams: unknown[] = [];
  const applicationPeriod = employerReportPeriodWhere(filters, 'ja', whereParams);
  const params: unknown[] = [];
  let fromAndWhere = '';
  let countFromAndWhere = '';
  let select = '';
  let countSelect = '';
  let order = '';
  let columns: Array<{ key: string; label: string; type: 'text' | 'date' | 'number' }> = [];

  if (type === 'job-performance') {
    fromAndWhere = `FROM jobs j
      LEFT JOIN job_applications ja ON ja."jobId" = j.id AND ${applicationPeriod}
      WHERE j."employerId" = $1 AND j."archivedAt" IS NULL`;
    countFromAndWhere = `FROM jobs j WHERE j."employerId" = $1 AND j."archivedAt" IS NULL`;
    select = `SELECT j.id AS "jobId", j.title, j.status, j."createdAt",
      COUNT(ja.id) AS "applicationCount",
      COALESCE(SUM(ja.status = 'HIRED'), 0) AS "hiredCount",
      COALESCE(SUM(ja.status = 'REJECTED'), 0) AS "rejectedCount"`;
    countSelect = 'SELECT COUNT(*) AS total';
    order = 'GROUP BY j.id, j.title, j.status, j."createdAt" ORDER BY j."createdAt" DESC, j.id';
    columns = [
      { key: 'jobId', label: 'Job ID', type: 'text' },
      { key: 'title', label: 'Job title', type: 'text' },
      { key: 'status', label: 'Publication status', type: 'text' },
      { key: 'createdAt', label: 'Created at', type: 'date' },
      { key: 'applicationCount', label: 'Applications', type: 'number' },
      { key: 'hiredCount', label: 'Hired', type: 'number' },
      { key: 'rejectedCount', label: 'Rejected', type: 'number' },
    ];
    params.push(...whereParams);
  } else if (type === 'applications') {
    fromAndWhere = `FROM job_applications ja
      JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
      JOIN job_seeker_profiles p ON p.id = ja."jobSeekerId"
      JOIN users u ON u.id = p."userId"
      WHERE j."employerId" = $1 AND ${applicationPeriod}`;
    countFromAndWhere = `FROM job_applications ja
      JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
      WHERE j."employerId" = $1 AND ${applicationPeriod}`;
    select = `SELECT ja.id AS "applicationId", j.title AS "jobTitle",
      u."fullName" AS "candidateName",
      CASE WHEN u."showEmail" = true AND u."profileVisibility" <> 'PRIVATE' THEN u.email ELSE NULL END AS "candidateEmail",
      ja.status, ja."appliedAt"`;
    countSelect = 'SELECT COUNT(*) AS total';
    order = 'ORDER BY ja."appliedAt" DESC, ja.id';
    columns = [
      { key: 'applicationId', label: 'Application ID', type: 'text' },
      { key: 'jobTitle', label: 'Job title', type: 'text' },
      { key: 'candidateName', label: 'Candidate', type: 'text' },
      { key: 'candidateEmail', label: 'Email (if shared)', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'appliedAt', label: 'Applied at', type: 'date' },
    ];
    params.push(...whereParams);
  } else if (type === 'candidate-activity') {
    fromAndWhere = `FROM job_applications ja
      JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
      JOIN job_seeker_profiles p ON p.id = ja."jobSeekerId"
      JOIN users u ON u.id = p."userId"
      WHERE j."employerId" = $1 AND ${applicationPeriod}`;
    countFromAndWhere = fromAndWhere;
    select = `SELECT u."fullName" AS "candidateName",
      CASE WHEN u."profileVisibility" <> 'PRIVATE' THEN p.headline ELSE NULL END AS headline,
      COUNT(ja.id) AS "applicationCount", MAX(ja."appliedAt") AS "latestApplicationAt"`;
    countSelect = 'SELECT COUNT(DISTINCT ja."jobSeekerId") AS total';
    order = 'GROUP BY p.id, u."fullName", u."profileVisibility", p.headline ORDER BY MAX(ja."appliedAt") DESC, p.id';
    columns = [
      { key: 'candidateName', label: 'Candidate', type: 'text' },
      { key: 'headline', label: 'Headline (if visible)', type: 'text' },
      { key: 'applicationCount', label: 'Applications', type: 'number' },
      { key: 'latestApplicationAt', label: 'Latest application', type: 'date' },
    ];
    params.push(...whereParams);
  } else {
    fromAndWhere = `FROM job_applications ja
      JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
      WHERE j."employerId" = $1 AND ${applicationPeriod}`;
    countFromAndWhere = fromAndWhere;
    select = `SELECT ja.status AS status, COUNT(*) AS "applicationCount"`;
    countSelect = `SELECT COUNT(DISTINCT ja.status) AS total`;
    order = `GROUP BY ja.status ORDER BY CASE ja.status
      WHEN 'APPLIED' THEN 1 WHEN 'SCREENING' THEN 2 WHEN 'SHORTLISTED' THEN 3
      WHEN 'TECHNICAL_ASSESSMENT' THEN 4 WHEN 'INTERVIEW_SCHEDULED' THEN 5
      WHEN 'OFFERED' THEN 6 WHEN 'HIRED' THEN 7 WHEN 'REJECTED' THEN 8
      WHEN 'WITHDRAWN' THEN 9 ELSE 10 END`;
    params.push(...whereParams);
    columns = [
      { key: 'status', label: 'Recruitment stage', type: 'text' },
      { key: 'applicationCount', label: 'Applications', type: 'number' },
    ];
  }

  return { fromAndWhere, countFromAndWhere, select, countSelect, order, columns, params };
}

export async function getEmployerReport(
  employerId: string,
  type: EmployerReportType,
  filters: EmployerReportQuery,
  includeAllRows = false,
) {
  const query = employerReportSql(type, filters);
  const scopeParams = [employerId, ...query.params];
  const [countResult, dataResult] = await Promise.all([
    db.query<{ total: number | string }>(
      `${query.countSelect} ${query.countFromAndWhere}`,
      type === 'job-performance' ? [employerId] : scopeParams,
    ),
    type === 'pipeline'
      ? db.query<EmployerRow>(
        `${query.select} ${query.fromAndWhere} ${query.order}`,
        scopeParams,
      )
      : db.query<EmployerRow>(
        `${query.select} ${query.fromAndWhere} ${query.order}
         LIMIT $${scopeParams.length + 1} OFFSET $${scopeParams.length + 2}`,
        [...scopeParams, includeAllRows ? EMPLOYER_REPORT_ROW_LIMIT + 1 : filters.pageSize, includeAllRows ? 0 : (filters.page - 1) * filters.pageSize],
      ),
  ]);
  const rows: EmployerRow[] = type === 'pipeline'
    ? employerApplicationStatuses.map((status) => ({
      status,
      applicationCount: Number(dataResult.rows.find((row) => row.status === status)?.applicationCount ?? 0),
    }))
    : dataResult.rows;
  const total = type === 'pipeline' ? rows.length : Number(countResult.rows[0]?.total ?? 0);
  const limitedRows = rows.slice(0, includeAllRows ? EMPLOYER_REPORT_ROW_LIMIT : filters.pageSize);
  const summary = type === 'pipeline'
    ? [
      { label: 'Total applications', value: rows.reduce((sum, row) => sum + Number(row.applicationCount), 0) },
      { label: 'Distinct stages', value: rows.filter((row) => Number(row.applicationCount) > 0).length },
      { label: 'Hired', value: Number(rows.find((row) => row.status === 'HIRED')?.applicationCount ?? 0) },
    ]
    : [
      { label: 'Matching records', value: total },
      ...(type === 'job-performance' ? [
        { label: 'Applications on this page', value: rows.reduce((sum, row) => sum + Number(row.applicationCount), 0) },
        { label: 'Hires on this page', value: rows.reduce((sum, row) => sum + Number(row.hiredCount), 0) },
      ] : type === 'applications' ? [
        { label: 'Applications in preview', value: limitedRows.length },
      ] : [
        { label: 'Candidates in preview', value: limitedRows.length },
      ]),
    ];
  return {
    columns: query.columns,
    rows: limitedRows,
    total,
    summary,
    truncated: includeAllRows && total > EMPLOYER_REPORT_ROW_LIMIT,
  };
}

export async function applicationBelongsToEmployer(applicationId: string, userId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT ja.id FROM job_applications ja JOIN jobs j ON ja."jobId" = j.id
     JOIN employer_profiles e ON j."employerId" = e.id
     WHERE ja.id = $1 AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL AND e."userId" = $2`,
    [applicationId, userId]
  );
  return result.rowCount > 0;
}

export async function updateApplicationStatus(
  applicationId: string,
  actor: EmployerActor,
  input: ApplicationStatusInput,
): Promise<void> {
  await db.transaction(async ({ query }) => {
    const result = await query<{
      id: string;
      employerUserId: string;
      candidateUserId: string;
      jobTitle: string;
      employerVerified: boolean;
      status: ApplicationStatus;
    }>(
      `SELECT ja.id, ja.status, ep."userId" AS "employerUserId", jsp."userId" AS "candidateUserId",
              j.title AS "jobTitle", ep."isApproved" AS "employerVerified"
       FROM job_applications ja
       JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
       JOIN employer_profiles ep ON ep.id = j."employerId" AND ep."archivedAt" IS NULL
       JOIN job_seeker_profiles jsp ON jsp.id = ja."jobSeekerId"
       WHERE ja.id = $1 AND ja."archivedAt" IS NULL
       FOR UPDATE`,
      [applicationId],
    );
    const application = result.rows[0];
    assertApplicationManaged(Boolean(application) && application!.employerUserId === actor.userId);
    assertEmployerIsVerified(Boolean(application!.employerVerified));
    assertApplicationStatusTransition(application!.status, input.status);
    await query(
      'UPDATE job_applications SET status = $1, "statusNotes" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3',
      [input.status, input.statusNotes || null, applicationId]
    );
    await query(
      `INSERT INTO application_messages
       (id, "applicationId", "senderUserId", "recipientUserId", kind, subject, body, "actionStatus", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'NONE', CURRENT_TIMESTAMP)`,
      [
        `msg-${randomUUID()}`,
        applicationId,
        actor.userId,
        application!.candidateUserId,
        input.status === 'SHORTLISTED' ? 'SHORTLISTED' : 'APPLICATION_UPDATE',
        input.status === 'SHORTLISTED' ? 'You have been shortlisted' : `Application update: ${input.status.replaceAll('_', ' ').toLowerCase()}`,
        input.statusNotes?.trim() || `Your application for ${application!.jobTitle} is now ${input.status.replaceAll('_', ' ').toLowerCase()}.`,
      ],
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, actor.userId, 'APPLICATION_STAGE_UPDATED', 'JobApplication', applicationId, `Status set to ${input.status}`]
    );
  });
}

export async function readAnalyticsData(employerId: string) {
  const [jobs, applications, requiredSkills, applicantSkills] = await Promise.all([
    db.query<EmployerRow>(
      `SELECT id, title, status, deadline, "createdAt",
        CASE WHEN status = 'ACTIVE' AND deadline IS NOT NULL AND DATE(deadline) < CURRENT_DATE
          THEN 'EXPIRED' ELSE status END AS "effectiveStatus"
       FROM jobs WHERE "employerId" = $1 AND "archivedAt" IS NULL`,
      [employerId]
    ),
    db.query<EmployerRow>(
      `SELECT ja.id, ja.status, ja."statusNotes", ja."matchScore", ja."appliedAt", ja."updatedAt", ja."jobSeekerId", ja."jobId"
       FROM job_applications ja JOIN jobs j ON ja."jobId" = j.id WHERE j."employerId" = $1 AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL`,
      [employerId]
    ),
    db.query<EmployerRow>(
      `SELECT DISTINCT jsr."skillId", s.name AS "skillName" FROM job_skill_requirements jsr
       JOIN jobs j ON jsr."jobId" = j.id JOIN skills s ON jsr."skillId" = s.id WHERE j."employerId" = $1 AND j."archivedAt" IS NULL`,
      [employerId]
    ),
    db.query<EmployerRow>(
      `SELECT DISTINCT jsk."skillId" FROM job_seeker_skills jsk
       JOIN job_applications ja ON jsk."jobSeekerId" = ja."jobSeekerId"
       JOIN jobs j ON ja."jobId" = j.id WHERE j."employerId" = $1 AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL`,
      [employerId]
    ),
  ]);
  return { jobs: jobs.rows, applications: applications.rows, requiredSkills: requiredSkills.rows, applicantSkills: applicantSkills.rows };
}
