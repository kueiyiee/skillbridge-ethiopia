import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../../infrastructure/database/drizzle';
import { prepareMysqlQuery } from '../../infrastructure/database/drizzle';
import { EmployerError } from './employers.errors';
import { candidateSearchSchema, employerReportExportQuerySchema, employerReportQuerySchema } from './employers.schemas';
import { assertApplicationStatusTransition, assertEmployerIsVerified, assertNoPendingVerification } from './employers.policy';
import {
  buildCandidateDiscoveryFilters,
  getDiscoverableCandidateDetails,
  getEmployerReport,
  searchDiscoverableCandidates,
} from './employers.repository';
import { countEmployerJobStatus } from './employers.service';
import employersRouter from './employers.routes';
import { apiModules } from '../index';
import { createEmployerReportCsv, safeEmployerSpreadsheetCell } from './employers.reports';

test('employer candidate and report endpoints are mounted under the expected API router', () => {
  const paths = employersRouter.stack.flatMap((layer) => layer.route ? [layer.route.path] : []);
  assert.ok(paths.includes('/me/candidates'));
  assert.ok(paths.includes('/me/candidates/:candidateId'));
  assert.ok(paths.includes('/me/reports'));
  assert.ok(paths.includes('/me/reports/:reportType/preview'));
  assert.ok(paths.includes('/me/reports/:reportType/export'));
  assert.ok(apiModules.some((module) => module.path === '/api/employers' && module.router === employersRouter));
});

test('employer cannot create another verification while one is pending', () => {
  assert.throws(
    () => assertNoPendingVerification(true),
    (error) => error instanceof EmployerError && error.statusCode === 409,
  );
  assert.doesNotThrow(() => assertNoPendingVerification(false));
});

test('unverified employers cannot use recruiting operations', () => {
  assert.throws(
    () => assertEmployerIsVerified(false),
    (error) => error instanceof EmployerError && error.statusCode === 403,
  );
  assert.doesNotThrow(() => assertEmployerIsVerified(true));
});

test('candidate search validates bounded filters and normalizes pagination', () => {
  const result = candidateSearchSchema.parse({
    q: '  Frontend ',
    skill: ' React ',
    location: ' Addis Ababa ',
    minExperience: '3',
    availability: 'available',
    sort: 'experience',
    page: '2',
    pageSize: '24',
  });
  assert.deepEqual(result, {
    q: 'Frontend',
    skill: 'React',
    location: 'Addis Ababa',
    minExperience: 3,
    availability: 'available',
    sort: 'experience',
    page: 2,
    pageSize: 24,
  });
  assert.equal(candidateSearchSchema.safeParse({ pageSize: '51' }).success, false);
  assert.equal(candidateSearchSchema.safeParse({ minExperience: '61' }).success, false);
  assert.equal(candidateSearchSchema.safeParse({ sort: 'salary' }).success, false);
});

test('candidate search query always requires both opt-ins and non-private visibility', () => {
  const { sql, params } = buildCandidateDiscoveryFilters(candidateSearchSchema.parse({}), 2);
  assert.match(sql, /u\."candidateSearchable" = true/);
  assert.match(sql, /u\."employerDiscoverable" = true/);
  assert.match(sql, /u\."profileVisibility" IN \('REGISTERED', 'PUBLIC'\)/);
  assert.match(sql, /u\."isActive" = true/);
  assert.match(sql, /u\."emailVerified" = true/);
  assert.deepEqual(params, []);
});

test('candidate search filters are parameterized and hidden locations cannot match', () => {
  const { sql, params } = buildCandidateDiscoveryFilters(candidateSearchSchema.parse({
    q: 'Engineer',
    skill: 'React',
    location: 'Addis',
    minExperience: '5',
    availability: 'unavailable',
  }), 2);
  assert.match(sql, /LOCATE\(\$2, LOWER\(COALESCE\(p\.headline/);
  assert.match(sql, /LOCATE\(\$3, LOWER\(ss\.name\)\)/);
  assert.match(sql, /u\."showLocation" = true/);
  assert.match(sql, /p\."experienceYears" >= \$5/);
  assert.match(sql, /p\."availableForWork" = \$6/);
  assert.deepEqual(params, ['engineer', 'react', 'addis', 5, false]);
  assert.equal(sql.includes('Engineer'), false);
});

test('candidate directory reads use verified employer scope, paginated counts, and only opted-in profiles', async () => {
  const originalQuery = db.query;
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  db.query = async <T = unknown>(sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT(*) AS total')) {
      return { rows: [{ total: '13' }] as T[], rowCount: 1 };
    }
    if (sql.includes('SELECT jsk."jobSeekerId" AS "profileId"')) {
      return {
        rows: [{ profileId: 'profile-1', name: 'React', proficiencyLevel: 'ADVANCED', yearsExperience: '2', isVerified: 1 }] as T[],
        rowCount: 1,
      };
    }
    return {
      rows: [{
        profileId: 'profile-1',
        fullName: 'Candidate One',
        headline: 'Frontend Engineer',
        desiredRole: null,
        experienceYears: 4,
        city: null,
        availableForWork: 1,
        applicationId: null,
      }] as T[],
      rowCount: 1,
    };
  };
  try {
    const result = await searchDiscoverableCandidates('verified-employer', candidateSearchSchema.parse({
      q: 'React',
      page: 2,
      pageSize: 12,
    }));
    assert.equal(result.total, 13);
    assert.equal(result.candidates[0].fullName, 'Candidate One');
    assert.equal(result.candidates[0].city, null);
    assert.equal(result.candidates[0].skills[0].isVerified, true);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].params, ['verified-employer', 'react']);
    assert.match(calls[0].sql, /u\."candidateSearchable" = true/);
    assert.match(calls[0].sql, /u\."employerDiscoverable" = true/);
    assert.match(calls[0].sql, /u\."profileVisibility" IN \('REGISTERED', 'PUBLIC'\)/);
    assert.deepEqual(calls[1].params, ['verified-employer', 'react', 'react', 12, 12]);
    assert.match(calls[1].sql, /e\."userId" = \$1 AND e\."isApproved" = true/);
  } finally {
    db.query = originalQuery;
  }
});

test('candidate detail lookup rechecks discovery consent and applies contact-field visibility', async () => {
  const originalQuery = db.query;
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  db.query = async <T = unknown>(sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('CASE WHEN u."showPhone"')) {
      return {
        rows: [{
          profileId: 'profile-1',
          fullName: 'Candidate One',
          experienceYears: 2,
          availableForWork: true,
          phone: null,
          email: null,
          gender: null,
          city: null,
          applicationId: null,
        }] as T[],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };
  try {
    const candidate = await getDiscoverableCandidateDetails('verified-employer', 'profile-1');
    assert.equal(candidate?.phone, null);
    assert.equal(candidate?.email, null);
    assert.equal(candidate?.gender, null);
    assert.equal(candidate?.city, null);
    assert.match(calls[0].sql, /u\."candidateSearchable" = true/);
    assert.match(calls[0].sql, /u\."employerDiscoverable" = true/);
    assert.match(calls[0].sql, /CASE WHEN u\."showPhone" = true THEN u\.phone ELSE NULL END/);
    assert.match(calls[0].sql, /CASE WHEN u\."showEmail" = true THEN u\.email ELSE NULL END/);
    assert.match(calls[0].sql, /CASE WHEN u\."showLocation" = true THEN p\.city ELSE NULL END/);
    assert.match(calls[0].sql, /CASE WHEN u\."showGender" = true THEN u\.gender ELSE NULL END/);
    assert.deepEqual(calls[0].params, ['verified-employer', 'profile-1']);
  } finally {
    db.query = originalQuery;
  }
});

test('employer report filters validate dates, order, pagination, and supported exports', () => {
  assert.equal(employerReportQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-01-31', page: '2' }).success, true);
  assert.equal(employerReportQuerySchema.safeParse({ startDate: 'not-a-date' }).success, false);
  assert.equal(employerReportQuerySchema.safeParse({ startDate: '2026-02-01', endDate: '2026-01-01' }).success, false);
  assert.equal(employerReportQuerySchema.safeParse({ pageSize: '101' }).success, false);
  assert.equal(employerReportExportQuerySchema.safeParse({ format: 'xlsx' }).success, false);
});

test('employer report reads are paginated, date-filtered, employer-scoped, and use parameter-safe SQL', async () => {
  const originalQuery = db.query;
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  db.query = async <T = unknown>(sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (/^\s*SELECT COUNT/i.test(sql)) return { rows: [{ total: '3' }] as T[], rowCount: 1 };
    if (sql.includes('GROUP BY ja.status')) {
      return { rows: [{ status: 'APPLIED', applicationCount: '4' }] as T[], rowCount: 1 };
    }
    return {
      rows: [{
        jobId: 'job-1',
        applicationId: 'application-1',
        candidateName: 'Candidate',
        title: 'Engineer',
        jobTitle: 'Engineer',
        status: 'ACTIVE',
        applicationCount: '4',
        hiredCount: '1',
        rejectedCount: '0',
        createdAt: '2026-01-01',
      }] as T[],
      rowCount: 1,
    };
  };
  try {
    for (const type of ['job-performance', 'applications', 'candidate-activity', 'pipeline'] as const) {
      calls.length = 0;
      const report = await getEmployerReport('employer-user-1', type, {
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        page: 2,
        pageSize: 1,
      });
      assert.ok(report.rows.length <= 1 || type === 'pipeline');
      assert.ok(calls.every(({ sql, params }) => {
        const prepared = prepareMysqlQuery(sql, params);
        return (prepared.sql.match(/\?/g) || []).length === prepared.params.length;
      }));
      const dataQuery = calls.find(({ sql }) => !/^\s*SELECT COUNT/i.test(sql));
      assert.ok(dataQuery);
      assert.match(dataQuery!.sql, /j\."employerId" = \$1/);
      assert.match(dataQuery!.sql, /ja\."appliedAt" >= \$2/);
      assert.match(dataQuery!.sql, /DATE_ADD\(\$3, INTERVAL 1 DAY\)/);
      if (type !== 'pipeline') {
        assert.equal(dataQuery!.params[0], 'employer-user-1');
        assert.equal(dataQuery!.params[1], '2026-01-01');
        assert.equal(dataQuery!.params[2], '2026-02-01');
        assert.equal(dataQuery!.params.at(-1), 1);
      }
      if (type === 'applications') {
        assert.match(dataQuery!.sql, /CASE WHEN u\."showEmail" = true AND u\."profileVisibility" <> 'PRIVATE'/);
      }
      if (type === 'candidate-activity') {
        assert.match(dataQuery!.sql, /CASE WHEN u\."profileVisibility" <> 'PRIVATE' THEN p\.headline ELSE NULL END/);
      }
    }
  } finally {
    db.query = originalQuery;
  }
});

test('employer CSV spreadsheet cells neutralize formula-leading text', () => {
  assert.equal(safeEmployerSpreadsheetCell('=1+1'), "'=1+1");
  assert.equal(safeEmployerSpreadsheetCell('  @SUM(A1:A2)'), "'  @SUM(A1:A2)");
  assert.equal(safeEmployerSpreadsheetCell('Candidate'), 'Candidate');
  assert.equal(safeEmployerSpreadsheetCell(42), 42);
});

test('employer CSV exports contain report records and escape spreadsheet formulas', () => {
  const csv = createEmployerReportCsv('applications', '2026-10-26T00:00:00.000Z', {
    startDate: '2026-10-01',
    endDate: '2026-10-26',
  }, [
    { key: 'candidateName', label: 'Candidate' },
    { key: 'jobTitle', label: 'Job title' },
  ], [{
    candidateName: '=HYPERLINK("https://example.test")',
    jobTitle: 'Developer',
  }]);
  assert.match(csv, /Report,Generated at \(UTC\),Start date,End date,Candidate,Job title/);
  assert.match(csv, /'=?HYPERLINK/);
  assert.match(csv, /Developer/);
  assert.match(csv, /2026-10-01/);
});

test('employer job metrics do not count expired postings as active', () => {
  const jobs = [
    { status: 'ACTIVE', effectiveStatus: 'EXPIRED' },
    { status: 'ACTIVE', effectiveStatus: 'ACTIVE' },
    { status: 'PAUSED', effectiveStatus: 'PAUSED' },
  ];
  assert.equal(countEmployerJobStatus(jobs, 'ACTIVE'), 1);
  assert.equal(countEmployerJobStatus(jobs, 'EXPIRED'), 1);
  assert.equal(countEmployerJobStatus(jobs, 'PAUSED'), 1);
});

test('recruitment status changes follow the supported forward-only hiring pipeline', () => {
  assert.doesNotThrow(() => assertApplicationStatusTransition('APPLIED', 'SHORTLISTED'));
  assert.doesNotThrow(() => assertApplicationStatusTransition('SHORTLISTED', 'INTERVIEW_SCHEDULED'));
  assert.doesNotThrow(() => assertApplicationStatusTransition('OFFERED', 'HIRED'));
  assert.throws(
    () => assertApplicationStatusTransition('APPLIED', 'HIRED'),
    (error) => error instanceof EmployerError && error.statusCode === 409,
  );
  assert.throws(
    () => assertApplicationStatusTransition('REJECTED', 'SCREENING'),
    (error) => error instanceof EmployerError && error.statusCode === 409,
  );
});