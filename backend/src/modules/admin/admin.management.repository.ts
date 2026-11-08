import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import type { AdminManagementEntity } from './admin.management.schemas';
import type { AdminActor } from './admin.types';
import { isLastActiveAdministrator } from './admin.policy';

type ManagementFilter = { page: number; pageSize: number; search: string; includeArchived: boolean };

const idPrefix: Record<AdminManagementEntity, string> = {
  users: 'usr',
  employers: 'emp',
  jobs: 'job',
  verifications: 'ver',
  applications: 'app',
};

function audit(query: (sql: string, params?: unknown[]) => Promise<unknown>, admin: AdminActor, action: string, entity: AdminManagementEntity, id: string, details: string) {
  return query(
    `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [`audit-${randomUUID()}`, admin.userId, action, entity, id, details.slice(0, 1000)]
  );
}

export async function listManagedRecords(entity: AdminManagementEntity, filters: ManagementFilter) {
  const archivedColumn: Record<AdminManagementEntity, string> = {
    users: 'archivedAt',
    employers: 'e.`archivedAt`',
    jobs: 'j.`archivedAt`',
    verifications: 'v.`archivedAt`',
    applications: 'a.`archivedAt`',
  };
  const archivedFilter = filters.includeArchived ? '' : ` AND ${archivedColumn[entity]} IS NULL`;
  const search = filters.search ? `%${filters.search}%` : null;
  const page = filters.page;
  const pageSize = filters.pageSize;
  const offset = (page - 1) * pageSize;

  const queries: Record<AdminManagementEntity, { from: string; columns: string; search: string }> = {
    users: {
      from: 'FROM users',
      columns: 'id, email, "fullName", phone, role, "isActive", "createdAt", "archivedAt"',
      search: '(id LIKE $1 OR email LIKE $1 OR "fullName" LIKE $1)',
    },
    employers: {
      from: 'FROM employer_profiles e JOIN users u ON u.id = e."userId"',
      columns: 'e.id, e."userId", u.email, e."companyName", e.industry, e.city, e.address, e.website, e."employeeRange", e."companyOverview", e."isApproved", e."createdAt", e."archivedAt"',
      search: '(e.id LIKE $1 OR e."companyName" LIKE $1 OR u.email LIKE $1)',
    },
    jobs: {
      from: 'FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"',
      columns: 'j.id, j."employerId", e."companyName", j.title, j.summary, j.responsibilities, j.qualifications, j.department, j."jobType", j.city, j."workplaceType", j."minExperienceYears", j."salaryMinETB", j."salaryMaxETB", j."isSalaryNegotiable", j.status, j.deadline, j."createdAt", j."archivedAt"',
      search: '(j.id LIKE $1 OR j.title LIKE $1 OR e."companyName" LIKE $1)',
    },
    verifications: {
      from: 'FROM employer_verification_records v JOIN employer_profiles e ON e.id = v."employerId"',
      columns: 'v.id, v."employerId", e."companyName", v."tinNumber", v."businessLicenseNo", v.status, v."reviewNotes", v."reviewerAdminId", v."reviewedAt", v."createdAt", v."archivedAt"',
      search: '(v.id LIKE $1 OR e."companyName" LIKE $1 OR v."tinNumber" LIKE $1)',
    },
    applications: {
      from: 'FROM job_applications a JOIN jobs j ON j.id = a."jobId" JOIN job_seeker_profiles p ON p.id = a."jobSeekerId" JOIN users u ON u.id = p."userId"',
      columns: 'a.id, a."jobId", j.title AS "jobTitle", a."jobSeekerId", u."fullName" AS "candidateName", a.status, a."coverNote", a."statusNotes", a."matchScore", a."appliedAt", a."archivedAt"',
      search: '(a.id LIKE $1 OR j.title LIKE $1 OR u."fullName" LIKE $1)',
    },
  };

  const query = queries[entity];
  const conditions = `WHERE 1 = 1${archivedFilter}${search ? ` AND ${query.search}` : ''}`;
  const params = search ? [search] : [];
  const [countResult, result] = await Promise.all([
    db.query<{ count: number | string }>(`SELECT count(*) AS count ${query.from} ${conditions}`, params),
    db.query(
      `SELECT ${query.columns} ${query.from} ${conditions} ORDER BY ${entity === 'applications' ? 'a."appliedAt"' : entity === 'jobs' ? 'j."createdAt"' : entity === 'verifications' ? 'v."createdAt"' : entity === 'employers' ? 'e."createdAt"' : '"createdAt"'} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    ),
  ]);
  const count = Number(countResult.rows[0]?.count ?? 0);
  return { count, data: result.rows, page, pageSize, totalPages: Math.ceil(count / pageSize) };
}

export async function createManagedRecord(entity: AdminManagementEntity, data: Record<string, unknown>, admin: AdminActor) {
  const id = `${idPrefix[entity]}-${randomUUID()}`;
  await db.transaction(async ({ query }) => {
    if (entity === 'users') {
      const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
      if (existing.rowCount > 0) throw Object.assign(new Error('An account already uses this email address.'), { statusCode: 409 });
      await query(
        `INSERT INTO users (id, email, "passwordHash", "fullName", phone, role, "isActive", "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, data.email, data.passwordHash, data.fullName, data.phone ?? null, data.role]
      );
      if (data.role === 'JOB_SEEKER') {
        await query(
          `INSERT INTO job_seeker_profiles (id, "userId", city, "availableForWork", "createdAt", "updatedAt")
           VALUES ($1, $2, 'Addis Ababa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [`prof-${randomUUID()}`, id]
        );
      } else {
        await query(
          `INSERT INTO employer_profiles (id, "userId", "companyName", industry, city, "isApproved", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'Other', 'Addis Ababa', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [`emp-${randomUUID()}`, id, `${String(data.fullName).trim()} Organization`]
        );
      }
    } else if (entity === 'employers') {
      const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
      if (existing.rowCount > 0) throw Object.assign(new Error('An account already uses this email address.'), { statusCode: 409 });
      const userId = `usr-${randomUUID()}`;
      await query(
        `INSERT INTO users (id, email, "passwordHash", "fullName", phone, role, "isActive", "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'EMPLOYER', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, data.email, data.passwordHash, data.fullName, data.phone ?? null]
      );
      await query(
        `INSERT INTO employer_profiles
         (id, "userId", "companyName", industry, city, address, website, "employeeRange", "companyOverview", "isApproved", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, userId, data.companyName, data.industry, data.city, data.address ?? null, data.website ?? null, data.employeeRange, data.companyOverview ?? null, data.isApproved ?? false]
      );
    } else if (entity === 'jobs') {
      const employer = await query<{ isApproved: boolean; archivedAt: Date | null; accountActive: boolean; accountArchivedAt: Date | null }>(
        `SELECT e."isApproved", e."archivedAt", u."isActive" AS "accountActive", u."archivedAt" AS "accountArchivedAt"
         FROM employer_profiles e JOIN users u ON u.id = e."userId" WHERE e.id = $1`,
        [data.employerId]
      );
      if (!employer.rows[0] || employer.rows[0].archivedAt || employer.rows[0].accountArchivedAt || !employer.rows[0].accountActive) {
        throw Object.assign(new Error('Choose an active employer profile.'), { statusCode: 400 });
      }
      if (data.status === 'ACTIVE' && !employer.rows[0].isApproved) {
        throw Object.assign(new Error('Jobs can only be published for an approved employer.'), { statusCode: 409 });
      }
      if (data.status === 'ACTIVE' && data.deadline && new Date(String(data.deadline)).getTime() < Date.now()) {
        throw Object.assign(new Error('An expired job cannot be published.'), { statusCode: 409 });
      }
      await query(
        `INSERT INTO jobs (id, "employerId", title, summary, responsibilities, qualifications, department, "jobType", city, "workplaceType", "minExperienceYears", "salaryMinETB", "salaryMaxETB", "isSalaryNegotiable", status, deadline, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, data.employerId, data.title, data.summary, JSON.stringify([data.responsibilities]), JSON.stringify([data.qualifications]), data.department ?? null, data.jobType, data.city, data.workplaceType, data.minExperienceYears, data.salaryMinETB ?? null, data.salaryMaxETB ?? null, data.isSalaryNegotiable, data.status, data.deadline ? new Date(String(data.deadline)) : null]
      );
    } else if (entity === 'verifications') {
      const employer = await query<{ id: string }>(
        'SELECT id FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NULL',
        [data.employerId]
      );
      if (!employer.rows[0]) throw Object.assign(new Error('Choose an active employer profile.'), { statusCode: 400 });
      await query(
        `INSERT INTO employer_verification_records (id, "employerId", "tinNumber", "businessLicenseNo", "documentUrl", status, "reviewerAdminId", "reviewNotes", "reviewedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $6 = 'PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, data.employerId, data.tinNumber, data.businessLicenseNo, data.documentUrl ?? null, data.status, data.status === 'PENDING' ? null : admin.userId, data.reviewNotes ?? null]
      );
      await query(
        `UPDATE employer_profiles SET "tinNumber" = $1, "businessLicenseNo" = $2,
         "isApproved" = CASE WHEN $3 = 'PENDING' THEN "isApproved" ELSE $4 END,
         "updatedAt" = CURRENT_TIMESTAMP WHERE id = $5`,
        [data.tinNumber, data.businessLicenseNo, data.status, data.status === 'APPROVED', data.employerId]
      );
    } else {
      const relations = await query(
        `SELECT j.id FROM jobs j
         JOIN employer_profiles e ON e.id = j."employerId"
         JOIN job_seeker_profiles p ON p.id = $2
         JOIN users u ON u.id = p."userId"
         WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
           AND u."archivedAt" IS NULL AND u."isActive" = true`,
        [data.jobId, data.jobSeekerId]
      );
      if (relations.rowCount === 0) throw Object.assign(new Error('Choose an active job and candidate profile.'), { statusCode: 400 });
      const duplicate = await query(
        'SELECT id FROM job_applications WHERE "jobId" = $1 AND "jobSeekerId" = $2',
        [data.jobId, data.jobSeekerId]
      );
      if (duplicate.rowCount > 0) throw Object.assign(new Error('An application already exists for this job and candidate.'), { statusCode: 409 });
      await query(
        `INSERT INTO job_applications (id, "jobId", "jobSeekerId", status, "coverNote", "statusNotes", "matchScore", "appliedAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, data.jobId, data.jobSeekerId, data.status, data.coverNote ?? null, data.statusNotes ?? null, data.matchScore]
      );
    }
    await audit(query, admin, 'ADMIN_RECORD_CREATED', entity, id, `Created ${entity} record.`);
  });
  return { id };
}

const fieldColumns: Record<AdminManagementEntity, Record<string, string>> = {
  users: { email: 'email', fullName: '"fullName"', phone: 'phone' },
  employers: { companyName: '"companyName"', industry: 'industry', city: 'city', address: 'address', website: 'website', employeeRange: '"employeeRange"', companyOverview: '"companyOverview"', isApproved: '"isApproved"' },
  jobs: { employerId: '"employerId"', title: 'title', summary: 'summary', responsibilities: 'responsibilities', qualifications: 'qualifications', department: 'department', jobType: '"jobType"', city: 'city', workplaceType: '"workplaceType"', minExperienceYears: '"minExperienceYears"', salaryMinETB: '"salaryMinETB"', salaryMaxETB: '"salaryMaxETB"', isSalaryNegotiable: '"isSalaryNegotiable"', status: 'status', deadline: 'deadline' },
  verifications: { employerId: '"employerId"', tinNumber: '"tinNumber"', businessLicenseNo: '"businessLicenseNo"', status: 'status', reviewNotes: '"reviewNotes"' },
  applications: { jobId: '"jobId"', jobSeekerId: '"jobSeekerId"', status: 'status', coverNote: '"coverNote"', statusNotes: '"statusNotes"', matchScore: '"matchScore"' },
};

const tableNames: Record<AdminManagementEntity, string> = {
  users: 'users',
  employers: 'employer_profiles',
  jobs: 'jobs',
  verifications: 'employer_verification_records',
  applications: 'job_applications',
};

export async function updateManagedRecord(entity: AdminManagementEntity, id: string, data: Record<string, unknown>, admin: AdminActor) {
  const entries = Object.entries(data).filter(([key]) => key !== 'password');
  if (entity === 'users' && typeof data.passwordHash === 'string') entries.push(['passwordHash', data.passwordHash]);
  if (entries.length === 0) throw Object.assign(new Error('At least one field is required.'), { statusCode: 400 });

  return db.transaction(async ({ query }) => {
    if (entity === 'users' && typeof data.email === 'string') {
      const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND id <> $2', [data.email, id]);
      if (existing.rowCount > 0) throw Object.assign(new Error('An account already uses this email address.'), { statusCode: 409 });
    }
    if (entity === 'jobs' && data.status === 'ACTIVE') {
      const selected = await query<{ isApproved: boolean; archivedAt: Date | null; deadline: Date | null; accountActive: boolean; accountArchivedAt: Date | null }>(
        `SELECT e."isApproved", e."archivedAt", j.deadline, u."isActive" AS "accountActive", u."archivedAt" AS "accountArchivedAt"
         FROM jobs j
         JOIN employer_profiles e ON e.id = ${data.employerId ? '$1' : 'j."employerId"'}
         JOIN users u ON u.id = e."userId"
         WHERE j.id = $${data.employerId ? 2 : 1}`,
        data.employerId ? [data.employerId, id] : [id]
      );
      if (!selected.rows[0] || selected.rows[0].archivedAt || selected.rows[0].accountArchivedAt || !selected.rows[0].accountActive || !selected.rows[0].isApproved) {
        throw Object.assign(new Error('Jobs can only be published for an active, approved employer.'), { statusCode: 409 });
      }
      const deadline = Object.prototype.hasOwnProperty.call(data, 'deadline')
        ? data.deadline ? new Date(String(data.deadline)) : null
        : selected.rows[0].deadline;
      if (deadline && deadline.getTime() < Date.now()) {
        throw Object.assign(new Error('An expired job cannot be published. Update its deadline first.'), { statusCode: 409 });
      }
    }
    if (entity === 'verifications' && data.employerId) {
      const employer = await query(
        'SELECT id FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NULL',
        [data.employerId]
      );
      if (!employer.rows[0]) throw Object.assign(new Error('Choose an active employer profile.'), { statusCode: 400 });
    }
    if (entity === 'applications' && (data.jobId || data.jobSeekerId)) {
      const current = await query<{ jobId: string; jobSeekerId: string }>(
        'SELECT "jobId", "jobSeekerId" FROM job_applications WHERE id = $1 AND "archivedAt" IS NULL',
        [id]
      );
      const jobId = String(data.jobId ?? current.rows[0]?.jobId ?? '');
      const jobSeekerId = String(data.jobSeekerId ?? current.rows[0]?.jobSeekerId ?? '');
      const relations = await query(
        `SELECT j.id FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
         JOIN job_seeker_profiles p ON p.id = $2 JOIN users u ON u.id = p."userId"
         WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
           AND u."archivedAt" IS NULL AND u."isActive" = true`,
        [jobId, jobSeekerId]
      );
      if (!relations.rows[0]) throw Object.assign(new Error('Choose an active job and candidate profile.'), { statusCode: 400 });
      const duplicate = await query(
        'SELECT id FROM job_applications WHERE "jobId" = $1 AND "jobSeekerId" = $2 AND id <> $3',
        [jobId, jobSeekerId, id]
      );
      if (duplicate.rowCount > 0) throw Object.assign(new Error('An application already exists for this job and candidate.'), { statusCode: 409 });
    }
    const assignments = entries.map(([key], index) => {
      const column = fieldColumns[entity][key];
      if (!column) throw Object.assign(new Error('Unsupported field.'), { statusCode: 400 });
      return `${column} = $${index + 1}`;
    });
    const values = entries.map(([key, value]) => {
      if (entity === 'jobs' && (key === 'responsibilities' || key === 'qualifications')) return JSON.stringify([value]);
      if (entity === 'jobs' && key === 'deadline' && value) return new Date(String(value));
      return value;
    });
    values.push(id);
    const result = await query(
      `UPDATE ${tableNames[entity]} SET ${assignments.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${values.length} AND "archivedAt" IS NULL`,
      values
    );
    if (result.rowCount === 0) throw Object.assign(new Error('Record not found.'), { statusCode: 404 });
    if (entity === 'verifications') {
      const record = await query<{ employerId: string; status: string }>('SELECT "employerId", status FROM employer_verification_records WHERE id = $1', [id]);
      if (record.rows[0]) {
        if (typeof data.status === 'string') {
          await query(
            `UPDATE employer_verification_records
             SET "reviewerAdminId" = CASE WHEN $1 = 'PENDING' THEN NULL ELSE $2 END,
                 "reviewedAt" = CASE WHEN $1 = 'PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END
             WHERE id = $3`,
            [data.status, admin.userId, id]
          );
        }
        await query(
          `UPDATE employer_profiles SET "tinNumber" = COALESCE($1, "tinNumber"),
           "businessLicenseNo" = COALESCE($2, "businessLicenseNo"), "isApproved" = $3,
           "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`,
          [data.tinNumber ?? null, data.businessLicenseNo ?? null, record.rows[0].status === 'APPROVED', record.rows[0].employerId]
        );
      }
    }
    await audit(query, admin, 'ADMIN_RECORD_UPDATED', entity, id, `Updated ${entity} record fields: ${entries.map(([key]) => key).join(', ')}.`);
    return { id };
  });
}

export async function archiveManagedRecord(entity: AdminManagementEntity, id: string, admin: AdminActor) {
  return db.transaction(async ({ query }) => {
    if (entity === 'users') {
      if (id === admin.userId) throw Object.assign(new Error('You cannot archive your own administrator account.'), { statusCode: 409 });
      const target = await query<{ role: string; isActive: boolean }>(
        'SELECT role, "isActive" FROM users WHERE id = $1 AND "archivedAt" IS NULL FOR UPDATE',
        [id]
      );
      if (!target.rows[0]) throw Object.assign(new Error('Record not found or already archived.'), { statusCode: 404 });
      if (target.rows[0].role === 'ADMIN' && target.rows[0].isActive) {
        const activeAdmins = await query(
          'SELECT id FROM users WHERE role = $1 AND "isActive" = true AND "archivedAt" IS NULL FOR UPDATE',
          ['ADMIN']
        );
        if (isLastActiveAdministrator(target.rows[0].role, true, activeAdmins.rowCount)) {
          throw Object.assign(new Error('Cannot archive the last active administrator.'), { statusCode: 409 });
        }
      }
    } else if (entity === 'employers') {
      const employer = await query<{ userId: string }>(
        'SELECT "userId" FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NULL FOR UPDATE',
        [id]
      );
      if (!employer.rows[0]) throw Object.assign(new Error('Record not found or already archived.'), { statusCode: 404 });
      await query(
        'UPDATE employer_profiles SET "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      await query(
        `UPDATE users SET "archivedAt" = (SELECT "archivedAt" FROM employer_profiles WHERE id = $1),
         "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 AND "archivedAt" IS NULL`,
        [id, employer.rows[0].userId]
      );
      await audit(query, admin, 'ADMIN_RECORD_ARCHIVED', entity, id, 'Archived employer and linked account; related history was preserved.');
      return;
    }
    const result = await query(
      `UPDATE ${tableNames[entity]} SET "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1 AND "archivedAt" IS NULL`,
      [id]
    );
    if (result.rowCount === 0) throw Object.assign(new Error('Record not found or already archived.'), { statusCode: 404 });
    await audit(query, admin, 'ADMIN_RECORD_ARCHIVED', entity, id, `Archived ${entity} record; related history was preserved.`);
  });
}

export async function restoreManagedRecord(entity: AdminManagementEntity, id: string, admin: AdminActor) {
  return db.transaction(async ({ query }) => {
    if (entity === 'employers') {
      const employer = await query<{ userId: string; archivedAt: Date }>(
        'SELECT "userId", "archivedAt" FROM employer_profiles WHERE id = $1 AND "archivedAt" IS NOT NULL FOR UPDATE',
        [id]
      );
      if (!employer.rows[0]) throw Object.assign(new Error('Archived record not found.'), { statusCode: 404 });
      await query(
        'UPDATE employer_profiles SET "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      await query(
        'UPDATE users SET "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "archivedAt" = $2',
        [employer.rows[0].userId, employer.rows[0].archivedAt]
      );
      await audit(query, admin, 'ADMIN_RECORD_RESTORED', entity, id, 'Restored employer and its account if they were archived together.');
      return;
    }
    const result = await query(
      `UPDATE ${tableNames[entity]} SET "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "archivedAt" IS NOT NULL`,
      [id]
    );
    if (result.rowCount === 0) throw Object.assign(new Error('Archived record not found.'), { statusCode: 404 });
    await audit(query, admin, 'ADMIN_RECORD_RESTORED', entity, id, `Restored ${entity} record.`);
  });
}

export async function getManagementOptions() {
  const [employers, jobs, candidates] = await Promise.all([
    db.query<{ id: string; label: string }>(
      `SELECT e.id, e."companyName" AS label FROM employer_profiles e JOIN users u ON u.id = e."userId"
       WHERE e."archivedAt" IS NULL AND u."archivedAt" IS NULL AND u."isActive" = true
       ORDER BY e."companyName" LIMIT 500`
    ),
    db.query<{ id: string; label: string }>(
      `SELECT j.id, j.title AS label FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
       WHERE j."archivedAt" IS NULL AND e."archivedAt" IS NULL
       ORDER BY j.title LIMIT 500`
    ),
    db.query<{ id: string; label: string }>(
      `SELECT p.id, u."fullName" AS label FROM job_seeker_profiles p
       JOIN users u ON u.id = p."userId"
       WHERE u."archivedAt" IS NULL AND u."isActive" = true
       ORDER BY u."fullName" LIMIT 500`
    ),
  ]);
  return { employers: employers.rows, jobs: jobs.rows, candidates: candidates.rows };
}
