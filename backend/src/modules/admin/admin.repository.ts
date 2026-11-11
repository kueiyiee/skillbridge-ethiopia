import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import { getAdminEmailVerificationStatus, getEmployerApprovalBlock, isLastActiveAdministrator } from './admin.policy';
import type { AdminActor, AdminAuditQuery, AdminJobModerationInput, AdminJobsQuery, AdminUsersQuery, AdminVerificationsQuery, UserModerationInput, VerificationReviewInput } from './admin.types';

export async function listAdminJobs(filters: AdminJobsQuery) {
  const conditions: string[] = ['j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'];
  const params: unknown[] = [];
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const searchParameter = `$${params.length}`;
    conditions.push(`(j.id LIKE ${searchParameter} OR j.title LIKE ${searchParameter} OR e."companyName" LIKE ${searchParameter})`);
  }
  if (filters.status === 'EXPIRED') {
    conditions.push(`j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE`);
  } else if (filters.status === 'ACTIVE') {
    conditions.push(`j.status = 'ACTIVE' AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE)`);
  } else if (filters.status) {
    params.push(filters.status);
    conditions.push(`j.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;
  const countParams = [...params];
  params.push(filters.pageSize, offset);
  const from = `FROM jobs j JOIN employer_profiles e ON j."employerId" = e.id`;
  const [countResult, result] = await Promise.all([
    db.query<{ count: number | string }>(`SELECT count(*) AS count ${from} ${where}`, countParams),
    db.query(
      `SELECT j.id, j.title, j.summary, j.status, j.deadline, j."createdAt", e."companyName", e."isApproved" AS "employerApproved",
        (SELECT count(*) FROM job_applications ja WHERE ja."jobId" = j.id) AS "applicantsCount",
        CASE WHEN j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE THEN true ELSE false END AS "isExpired"
       ${from} ${where} ORDER BY j."createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
  ]);
  const count = Number(countResult.rows[0]?.count ?? 0);
  return { count, data: result.rows, page: filters.page, pageSize: filters.pageSize, totalPages: Math.ceil(count / filters.pageSize) };
}

export async function moderateAdminJob(jobId: string, admin: AdminActor, input: AdminJobModerationInput): Promise<'updated' | 'not_found' | 'unchanged' | 'expired' | 'unverified'> {
  return db.transaction(async ({ query }) => {
    const selected = await query<{ status: string; isExpired: boolean; employerApproved: boolean }>(
      `SELECT j.status, e."isApproved" AS "employerApproved",
        CASE WHEN j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE THEN true ELSE false END AS "isExpired"
       FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
       WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL FOR UPDATE`,
      [jobId]
    );
    if (selected.rowCount === 0) return 'not_found';
    const previousStatus = selected.rows[0].status;
    if (input.status === 'ACTIVE' && selected.rows[0].isExpired) return 'expired';
    if (input.status === 'ACTIVE' && !selected.rows[0].employerApproved) return 'unverified';
    if (previousStatus === input.status) return 'unchanged';

    await query('UPDATE jobs SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 AND "archivedAt" IS NULL', [input.status, jobId]);
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, admin.userId, 'ADMIN_JOB_STATUS_CHANGED', 'Job', jobId, `Status changed from ${previousStatus} to ${input.status}: ${input.reason}`]
    );
    return 'updated';
  });
}

export async function listVerifications(filters: AdminVerificationsQuery) {
  const conditions: string[] = ['e."archivedAt" IS NULL', 'u."archivedAt" IS NULL', "u.role = 'EMPLOYER'"];
  const hasEmailVerificationEvidence = `(u."emailVerificationMethod" IN ('email_otp', 'admin_manual')
    OR u."emailVerifiedAt" IS NOT NULL
    OR EXISTS (SELECT 1 FROM email_verification_challenges evc
      WHERE evc."userId" = u.id AND evc."verifiedAt" IS NOT NULL))`;
  const params: unknown[] = [];
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const searchParameter = `$${params.length}`;
    conditions.push(`(e."companyName" LIKE ${searchParameter} OR u."fullName" LIKE ${searchParameter} OR u.email LIKE ${searchParameter})`);
  }
  if (filters.status) {
    if (filters.status === 'NOT_SUBMITTED') conditions.push('evr.id IS NULL');
    else {
      params.push(filters.status);
      conditions.push(`evr.status = $${params.length}`);
    }
  }
  if (filters.emailStatus === 'verified') {
    conditions.push(`u."emailVerified" = true AND ${hasEmailVerificationEvidence}`);
  } else if (filters.emailStatus === 'unverified') {
    conditions.push(`u."emailVerified" = false AND u."isActive" = false
      AND u."emailVerificationMethod" IS NULL AND u."emailVerifiedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM email_verification_challenges evc WHERE evc."userId" = u.id AND evc."verifiedAt" IS NOT NULL)`);
  } else if (filters.emailStatus === 'action_required') {
    conditions.push(`(u."emailVerified" = true AND NOT ${hasEmailVerificationEvidence})
      OR (u."emailVerified" = false AND (u."isActive" = true OR u."emailVerificationMethod" IS NOT NULL
        OR u."emailVerifiedAt" IS NOT NULL OR EXISTS (SELECT 1 FROM email_verification_challenges evc
          WHERE evc."userId" = u.id AND evc."verifiedAt" IS NOT NULL)))`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;
  const countParams = [...params];
  params.push(filters.pageSize, offset);
  const sortColumns = {
    createdAt: 'COALESCE(evr."createdAt", e."createdAt")',
    companyName: 'e."companyName"',
    email: 'u.email',
    status: 'evr.status',
  } as const;
  const direction = filters.direction === 'asc' ? 'ASC' : 'DESC';
  const from = `FROM employer_profiles e
    JOIN users u ON e."userId" = u.id
    LEFT JOIN employer_verification_records evr ON evr.id = (
      SELECT latest.id FROM employer_verification_records latest
      WHERE latest."employerId" = e.id AND latest."archivedAt" IS NULL
      ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1
    )
    LEFT JOIN users reviewer ON evr."reviewerAdminId" = reviewer.id`;
  const [countResult, result] = await Promise.all([
    db.query<{ count: number | string }>(`SELECT count(*) AS count ${from} ${where}`, countParams),
    db.query(
      `SELECT evr.id, evr.id AS "verificationRecordId", e.id AS "employerId", evr."tinNumber", evr."businessLicenseNo",
        COALESCE(evr.status, 'NOT_SUBMITTED') AS status, evr."reviewerAdminId", evr."reviewNotes",
        evr."reviewedAt", evr."createdAt" AS "submittedAt", e."companyName", e.industry, e.city,
        e.address, e.website, e."companyOverview", e."employeeRange", e."userId", u."fullName" AS "accountHolderName",
        u.email AS "contactEmail", u."emailVerified", u."isActive" AS "accountActive",
        u."emailVerificationMethod", u."emailVerifiedAt",
        (SELECT MAX(evc."verifiedAt") FROM email_verification_challenges evc
         WHERE evc."userId" = u.id AND evc."verifiedAt" IS NOT NULL) AS "challengeVerifiedAt",
        reviewer."fullName" AS "reviewerName",
        (SELECT COUNT(*) FROM employer_verification_documents document
         WHERE document."verificationRecordId" = evr.id AND document."archivedAt" IS NULL) AS "documentCount"
       ${from} ${where} ORDER BY ${sortColumns[filters.sort]} ${direction}, e.id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
  ]);
  const count = Number(countResult.rows[0]?.count ?? 0);
  const data = result.rows.map((row) => ({
    ...row,
    emailVerificationStatus: getAdminEmailVerificationStatus(
      Boolean(row.emailVerified),
      row.emailVerificationMethod ?? null,
      row.emailVerifiedAt ?? null,
      row.challengeVerifiedAt ?? null,
      Boolean(row.accountActive),
    ),
  }));
  return { count, data, page: filters.page, pageSize: filters.pageSize, totalPages: Math.ceil(count / filters.pageSize) };
}

export async function getEmployerVerificationSummary() {
  const result = await db.query<{
    totalEmployers: number | string;
    awaitingBusinessVerification: number | string;
    awaitingEmailVerification: number | string;
    awaitingEmployerEmailVerification: number | string;
    verifiedEmployers: number | string;
    rejectedApplications: number | string;
    needsMoreInformation: number | string;
    documentsAwaitingReview: number | string;
  }>(
    `SELECT COUNT(*) AS totalEmployers,
       COALESCE(SUM(e."isApproved" = false AND COALESCE(v.status, 'NOT_SUBMITTED') IN ('PENDING', 'NOT_SUBMITTED')), 0) AS awaitingBusinessVerification,
       (SELECT COUNT(*) FROM users pending
        WHERE pending."archivedAt" IS NULL
          AND pending.role IN ('JOB_SEEKER', 'EMPLOYER')
          AND pending."emailVerified" = false AND pending."isActive" = false
          AND pending."emailVerificationMethod" IS NULL AND pending."emailVerifiedAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM email_verification_challenges evc
            WHERE evc."userId" = pending.id AND evc."verifiedAt" IS NOT NULL)) AS awaitingEmailVerification,
       COALESCE(SUM(u."emailVerified" = false AND u."isActive" = false
         AND u."emailVerificationMethod" IS NULL AND u."emailVerifiedAt" IS NULL
         AND NOT EXISTS (SELECT 1 FROM email_verification_challenges evc
           WHERE evc."userId" = u.id AND evc."verifiedAt" IS NOT NULL)), 0) AS awaitingEmployerEmailVerification,
       COALESCE(SUM(e."isApproved" = true), 0) AS verifiedEmployers,
       (SELECT COUNT(*) FROM employer_verification_records v
        JOIN employer_profiles ve ON ve.id = v."employerId"
        WHERE ve."archivedAt" IS NULL AND v."archivedAt" IS NULL AND v.status = 'REJECTED') AS rejectedApplications,
       (SELECT COUNT(*) FROM employer_verification_records v
        JOIN employer_profiles ve ON ve.id = v."employerId"
        WHERE ve."archivedAt" IS NULL AND v."archivedAt" IS NULL AND v.status = 'RESUBMISSION_REQUIRED') AS needsMoreInformation,
       (SELECT COUNT(*) FROM employer_verification_documents document
        JOIN employer_profiles de ON de.id = document."employerId"
        JOIN users du ON du.id = de."userId"
        WHERE de."archivedAt" IS NULL AND du."archivedAt" IS NULL
          AND document."archivedAt" IS NULL
          AND document.status IN ('PENDING', 'RESUBMISSION_REQUIRED')) AS documentsAwaitingReview
     FROM employer_profiles e
     JOIN users u ON u.id = e."userId"
     LEFT JOIN employer_verification_records v ON v.id = (
       SELECT latest.id FROM employer_verification_records latest
       WHERE latest."employerId" = e.id AND latest."archivedAt" IS NULL
       ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1
     )
     WHERE e."archivedAt" IS NULL AND u."archivedAt" IS NULL AND u.role = 'EMPLOYER'`,
  );
  const summary = result.rows[0];
  if (!summary) throw new Error('Employer verification summary query returned no result.');
  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value)])) as {
    totalEmployers: number;
    awaitingBusinessVerification: number;
    awaitingEmailVerification: number;
    awaitingEmployerEmailVerification: number;
    verifiedEmployers: number;
    rejectedApplications: number;
    needsMoreInformation: number;
    documentsAwaitingReview: number;
  };
}

export async function reviewVerification(recordId: string, admin: AdminActor, input: VerificationReviewInput): Promise<'updated' | 'not_found' | 'conflict' | 'email_unverified' | 'email_verification_action_required' | 'requirements_incomplete' | 'documents_incomplete'> {
  return db.transaction(async ({ query }) => {
    const verification = await query(
      `SELECT v.*, e."isApproved" AS "employerApproved", u."emailVerified",
        u."emailVerificationMethod", u."emailVerifiedAt", u."isActive" AS "accountActive",
        (SELECT MAX(evc."verifiedAt") FROM email_verification_challenges evc
          WHERE evc."userId" = u.id AND evc."verifiedAt" IS NOT NULL) AS "challengeVerifiedAt"
       FROM employer_verification_records v
       JOIN employer_profiles e ON e.id = v."employerId"
       JOIN users u ON u.id = e."userId"
       WHERE v.id = $1 AND v."archivedAt" IS NULL AND e."archivedAt" IS NULL AND u."archivedAt" IS NULL
       FOR UPDATE`,
      [recordId]
    );
    if (verification.rowCount === 0) return 'not_found';
    const record = verification.rows[0];
    if (record.status === 'APPROVED' || record.status === 'REJECTED') return 'conflict';
    const unreviewedDocuments = input.status === 'APPROVED'
      ? await query<{ count: number | string }>(
        `SELECT COUNT(*) AS count FROM employer_verification_documents
         WHERE "verificationRecordId" = $1 AND "archivedAt" IS NULL AND status <> 'APPROVED'`,
        [record.id],
      )
      : null;
    const emailStatus = getAdminEmailVerificationStatus(
      Boolean(record.emailVerified),
      record.emailVerificationMethod ?? null,
      record.emailVerifiedAt ?? null,
      record.challengeVerifiedAt ?? null,
      Boolean(record.accountActive),
    );
    const approvalBlock = input.status === 'APPROVED'
      ? emailStatus === 'action_required'
        ? 'email_verification_action_required'
        : getEmployerApprovalBlock(
        emailStatus === 'verified',
        record.tinNumber,
        record.businessLicenseNo,
        Number(unreviewedDocuments?.rows[0]?.count ?? 0) === 0,
      )
      : null;
    if (approvalBlock === 'email_verification_action_required') {
      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, 'EMPLOYER_VERIFICATION_APPROVAL_BLOCKED', 'EmployerVerificationRecord', $3, $4)`,
        [`audit-${randomUUID()}`, admin.userId, record.id, 'Approval blocked: email verification evidence is missing or inconsistent.'],
      );
      return approvalBlock;
    }
    if (approvalBlock === 'email_unverified') {
      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, 'EMPLOYER_VERIFICATION_APPROVAL_BLOCKED', 'EmployerVerificationRecord', $3, $4)`,
        [`audit-${randomUUID()}`, admin.userId, record.id, 'Approval blocked: account email is not verified.']
      );
      return approvalBlock;
    }
    if (approvalBlock === 'requirements_incomplete') {
      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, 'EMPLOYER_VERIFICATION_APPROVAL_BLOCKED', 'EmployerVerificationRecord', $3, $4)`,
        [`audit-${randomUUID()}`, admin.userId, record.id, 'Approval blocked: required business identifiers are incomplete.']
      );
      return approvalBlock;
    }
    if (approvalBlock === 'documents_incomplete') {
      await query(
        `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
         VALUES ($1, $2, 'EMPLOYER_VERIFICATION_APPROVAL_BLOCKED', 'EmployerVerificationRecord', $3, $4)`,
        [`audit-${randomUUID()}`, admin.userId, record.id, 'Approval blocked: submitted documents have not all been approved.']
      );
      return approvalBlock;
    }

    await query(
      `UPDATE employer_verification_records
       SET status = $1, "reviewerAdminId" = $2, "reviewNotes" = $3, "reviewedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [input.status, admin.userId, input.reviewNotes, record.id]
    );
    await query(
      'UPDATE employer_profiles SET "isApproved" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [input.status === 'APPROVED', record.employerId]
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, admin.userId, `EMPLOYER_VERIFICATION_${input.status}`, 'EmployerVerificationRecord', record.id, `Decision recorded: ${input.status}. Review notes: ${input.reviewNotes}`]
    );
    return 'updated';
  });
}

export async function listUsers(filters: AdminUsersQuery) {
  const conditions: string[] = ['"archivedAt" IS NULL'];
  const params: unknown[] = [];
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const searchParameter = `$${params.length}`;
    conditions.push(`(id LIKE ${searchParameter} OR email LIKE ${searchParameter} OR "fullName" LIKE ${searchParameter})`);
  }
  if (filters.role) {
    params.push(filters.role);
    conditions.push(`role = $${params.length}`);
  }
  if (filters.status) {
    if (filters.status === 'active') {
      conditions.push('"isActive" = true');
    } else if (filters.status === 'pending_verification') {
      conditions.push(`"isActive" = false AND "emailVerified" = false AND NOT EXISTS (
        SELECT 1 FROM platform_audit_logs moderation
        WHERE moderation."entityType" = 'User' AND moderation."entityId" = users.id
          AND moderation.action IN ('USER_SUSPENDED', 'USER_ACTIVATED')
          AND moderation."createdAt" = (
            SELECT MAX(latest."createdAt") FROM platform_audit_logs latest
            WHERE latest."entityType" = 'User' AND latest."entityId" = users.id
              AND latest.action IN ('USER_SUSPENDED', 'USER_ACTIVATED')
          )
          AND moderation.action = 'USER_SUSPENDED'
      )`);
    } else {
      conditions.push(`"isActive" = false AND ("emailVerified" = true OR EXISTS (
        SELECT 1 FROM platform_audit_logs moderation
        WHERE moderation."entityType" = 'User' AND moderation."entityId" = users.id
          AND moderation.action = 'USER_SUSPENDED'
          AND moderation."createdAt" = (
            SELECT MAX(latest."createdAt") FROM platform_audit_logs latest
            WHERE latest."entityType" = 'User' AND latest."entityId" = users.id
              AND latest.action IN ('USER_SUSPENDED', 'USER_ACTIVATED')
          )
      ))`);
    }
  }
  const hasChallengeEvidence = `EXISTS (
    SELECT 1 FROM email_verification_challenges evc
    WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL
  )`;
  if (filters.emailStatus === 'verified') {
    conditions.push(`"emailVerified" = true AND ("emailVerificationMethod" IN ('email_otp', 'admin_manual') OR "emailVerifiedAt" IS NOT NULL OR ${hasChallengeEvidence})`);
  } else if (filters.emailStatus === 'unverified') {
    conditions.push(`"emailVerified" = false AND "isActive" = false AND "emailVerificationMethod" IS NULL AND "emailVerifiedAt" IS NULL AND NOT ${hasChallengeEvidence}`);
  } else if (filters.emailStatus === 'action_required') {
    conditions.push(`("emailVerified" = true AND ("emailVerificationMethod" NOT IN ('email_otp', 'admin_manual') OR "emailVerificationMethod" IS NULL) AND "emailVerifiedAt" IS NULL AND NOT ${hasChallengeEvidence})
      OR ("emailVerified" = false AND ("isActive" = true OR "emailVerificationMethod" IS NOT NULL OR "emailVerifiedAt" IS NOT NULL OR ${hasChallengeEvidence}))`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;
  const countParams = [...params];
  params.push(filters.pageSize, offset);
  const [countResult, result, summaryResult] = await Promise.all([
    db.query<{ count: number | string }>(`SELECT count(*) AS count FROM users ${where}`, countParams),
    db.query(
      `SELECT id, email, "fullName", phone, role, "isActive",
        CASE
          WHEN "isActive" = true THEN 'active'
          WHEN "emailVerified" = false AND NOT EXISTS (
            SELECT 1 FROM platform_audit_logs moderation
            WHERE moderation."entityType" = 'User' AND moderation."entityId" = users.id
              AND moderation.action = 'USER_SUSPENDED'
              AND moderation."createdAt" = (
                SELECT MAX(latest."createdAt") FROM platform_audit_logs latest
                WHERE latest."entityType" = 'User' AND latest."entityId" = users.id
                  AND latest.action IN ('USER_SUSPENDED', 'USER_ACTIVATED')
              )
          ) THEN 'pending_verification'
          ELSE 'suspended'
        END AS "accountStatus",
        "emailVerified", "emailVerificationMethod", "emailVerifiedAt", "createdAt",
        (SELECT MAX(evc."verifiedAt") FROM email_verification_challenges evc
         WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL) AS "challengeVerifiedAt"
       FROM users ${where}
       ORDER BY "createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
    db.query(`SELECT
      COUNT(*) AS totalAccounts,
      SUM(CASE WHEN "emailVerified" = true
        AND ("emailVerificationMethod" IN ('email_otp', 'admin_manual') OR "emailVerifiedAt" IS NOT NULL OR EXISTS (
          SELECT 1 FROM email_verification_challenges evc WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL
        )) THEN 1 ELSE 0 END) AS verifiedEmails,
      SUM(CASE WHEN "emailVerified" = false
        AND "isActive" = false AND "emailVerificationMethod" IS NULL AND "emailVerifiedAt" IS NULL AND NOT EXISTS (
          SELECT 1 FROM email_verification_challenges evc WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL
        ) THEN 1 ELSE 0 END) AS accountsNeedingVerification,
      SUM(CASE WHEN ("emailVerified" = true AND ("emailVerificationMethod" NOT IN ('email_otp', 'admin_manual') OR "emailVerificationMethod" IS NULL) AND "emailVerifiedAt" IS NULL AND NOT EXISTS (
          SELECT 1 FROM email_verification_challenges evc WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL
        )) OR ("emailVerified" = false AND ("isActive" = true OR "emailVerificationMethod" IS NOT NULL OR "emailVerifiedAt" IS NOT NULL OR EXISTS (
          SELECT 1 FROM email_verification_challenges evc WHERE evc."userId" = users.id AND evc."verifiedAt" IS NOT NULL
        ))) THEN 1 ELSE 0 END) AS emailVerificationActionRequired,
      SUM(CASE WHEN "isActive" = false AND ("emailVerified" = true OR EXISTS (
        SELECT 1 FROM platform_audit_logs moderation
        WHERE moderation."entityType" = 'User' AND moderation."entityId" = users.id
          AND moderation.action = 'USER_SUSPENDED'
          AND moderation."createdAt" = (
            SELECT MAX(latest."createdAt") FROM platform_audit_logs latest
            WHERE latest."entityType" = 'User' AND latest."entityId" = users.id
              AND latest.action IN ('USER_SUSPENDED', 'USER_ACTIVATED')
          )
      )) THEN 1 ELSE 0 END) AS suspendedAccounts
      FROM users WHERE "archivedAt" IS NULL`),
  ]);
  const count = Number(countResult.rows[0]?.count ?? 0);
  const data = result.rows.map((row) => ({
    ...row,
    emailVerificationStatus: getAdminEmailVerificationStatus(
      Boolean(row.emailVerified),
      row.emailVerificationMethod ?? null,
      row.emailVerifiedAt ?? null,
      row.challengeVerifiedAt ?? null,
      row.isActive,
    ),
  }));
  const summary = summaryResult.rows[0];
  return {
    count,
    data,
    summary: {
      totalAccounts: Number(summary?.totalAccounts ?? 0),
      verifiedEmails: Number(summary?.verifiedEmails ?? 0),
      accountsNeedingVerification: Number(summary?.accountsNeedingVerification ?? 0),
      emailVerificationActionRequired: Number(summary?.emailVerificationActionRequired ?? 0),
      suspendedAccounts: Number(summary?.suspendedAccounts ?? 0),
    },
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(count / filters.pageSize),
  };
}

export async function moderateUser(targetId: string, admin: AdminActor, input: UserModerationInput): Promise<'updated' | 'not_found' | 'last_admin'> {
  return db.transaction(async ({ query }) => {
    const target = await query<{ role: string; isActive: boolean }>(
      'SELECT role, "isActive" FROM users WHERE id = $1 AND "archivedAt" IS NULL FOR UPDATE',
      [targetId]
    );
    if (target.rowCount === 0) return 'not_found';
    if (target.rows[0].role === 'ADMIN' && target.rows[0].isActive && !input.isActive) {
      const activeAdmins = await query('SELECT id FROM users WHERE role = $1 AND "isActive" = true AND "archivedAt" IS NULL FOR UPDATE', ['ADMIN']);
      if (isLastActiveAdministrator(target.rows[0].role, target.rows[0].isActive, activeAdmins.rowCount)) return 'last_admin';
    }

    const result = await query(
      'UPDATE users SET "isActive" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [input.isActive, targetId]
    );
    if (result.rowCount === 0) return 'not_found';

    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, admin.userId, input.isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED', 'User', targetId, input.reason?.slice(0, 500) ?? 'Administrative action']
    );
    return 'updated';
  });
}

export async function listAuditLogs(filters: AdminAuditQuery) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.action) {
    params.push(filters.action);
    conditions.push(`pal.action = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const searchParameter = `$${params.length}`;
    conditions.push(`(pal.action LIKE ${searchParameter} OR pal."entityType" LIKE ${searchParameter} OR pal."entityId" LIKE ${searchParameter} OR pal.details LIKE ${searchParameter})`);
  }
  if (filters.from) {
    params.push(new Date(filters.from));
    conditions.push(`pal."createdAt" >= $${params.length}`);
  }
  if (filters.to) {
    params.push(new Date(filters.to));
    conditions.push(`pal."createdAt" <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;
  const countParams = [...params];
  params.push(filters.pageSize, offset);
  const [countResult, result] = await Promise.all([
    db.query<{ count: number | string }>(`SELECT count(*) AS count FROM platform_audit_logs pal ${where}`, countParams),
    db.query(
      `SELECT pal.id, pal."userId", pal.action, pal."entityType", pal."entityId", pal.details, pal."createdAt",
        u."fullName" AS "actorName", u.role AS "actorRole"
       FROM platform_audit_logs pal LEFT JOIN users u ON pal."userId" = u.id ${where}
       ORDER BY pal."createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
  ]);
  const count = Number(countResult.rows[0]?.count ?? 0);
  return { count, data: result.rows, page: filters.page, pageSize: filters.pageSize, totalPages: Math.ceil(count / filters.pageSize) };
}

export async function readMetricCounts() {
  const [candidates, employers, verifications, jobs, applications, evaluations] = await Promise.all([
    db.query(`SELECT count(*) AS count,
      count(CASE WHEN "isActive" = true THEN 1 END) AS active_count,
      count(CASE WHEN "isActive" = false THEN 1 END) AS suspended_count,
      count(CASE WHEN "createdAt" >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY) THEN 1 END) AS recent_count
      FROM users WHERE role = 'JOB_SEEKER' AND "archivedAt" IS NULL`),
    db.query(`SELECT count(*) AS count,
      count(CASE WHEN "isApproved" = true THEN 1 END) AS approved_count
      FROM employer_profiles e JOIN users u ON u.id = e."userId"
      WHERE e."archivedAt" IS NULL AND u."archivedAt" IS NULL`),
    db.query(`SELECT
      count(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
      count(CASE WHEN status = 'REJECTED' THEN 1 END) AS rejected_count,
      count(CASE WHEN status = 'RESUBMISSION_REQUIRED' THEN 1 END) AS resubmission_count
      FROM employer_verification_records v JOIN employer_profiles e ON e.id = v."employerId"
      WHERE v."archivedAt" IS NULL AND e."archivedAt" IS NULL`),
    db.query(`SELECT count(*) AS total_count,
      count(CASE WHEN j.status = 'ACTIVE' AND e."isApproved" = true AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE) THEN 1 END) AS active_count,
      count(CASE WHEN j.status = 'DRAFT' THEN 1 END) AS draft_count,
      count(CASE WHEN j.status = 'PAUSED' THEN 1 END) AS paused_count,
      count(CASE WHEN j.status = 'CLOSED' THEN 1 END) AS closed_count,
      count(CASE WHEN j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE THEN 1 END) AS expired_count
      FROM jobs j JOIN employer_profiles e ON j."employerId" = e.id
      JOIN users u ON u.id = e."userId"
      WHERE j."archivedAt" IS NULL AND e."archivedAt" IS NULL
        AND u."archivedAt" IS NULL AND u."isActive" = true`),
    db.query(`SELECT count(*) AS count, avg("matchScore") AS avg_score,
      count(CASE WHEN status = 'APPLIED' THEN 1 END) AS applied_count,
      count(CASE WHEN status IN ('SCREENING', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED') THEN 1 END) AS in_review_count,
      count(CASE WHEN status = 'OFFERED' THEN 1 END) AS offered_count,
      count(CASE WHEN status = 'REJECTED' THEN 1 END) AS rejected_count,
      count(CASE WHEN status = 'WITHDRAWN' THEN 1 END) AS withdrawn_count
      FROM job_applications WHERE "archivedAt" IS NULL`),
    db.query('SELECT count(*) AS count FROM employer_feedbacks'),
  ]);
  return { candidates, employers, verifications, jobs, applications, evaluations };
}

export async function getMfaAdoptionSummary() {
  const result = await db.query<{ role: string; totalAccounts: number | string; mfaEnabled: number | string }>(
    `SELECT users.role,
       COUNT(DISTINCT users.id) AS totalAccounts,
       COUNT(DISTINCT CASE WHEN user_mfa_factors.enabledAt IS NOT NULL THEN users.id END) AS mfaEnabled
     FROM users
     LEFT JOIN user_mfa_factors ON user_mfa_factors.userId = users.id
     WHERE users.isActive = true AND users.archivedAt IS NULL
     GROUP BY users.role
     ORDER BY users.role`,
  );
  return result.rows.map((row) => ({
    role: row.role,
    totalAccounts: Number(row.totalAccounts),
    mfaEnabled: Number(row.mfaEnabled),
  }));
}
