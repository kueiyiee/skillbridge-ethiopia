import { db } from '../../infrastructure/database/drizzle';
import { getSystemStatus } from '../system/system.service';
import { getAdminMetrics } from './admin.service';
import { AdminError } from './admin.errors';
import type { AdminReportQuery } from './admin.types';

export const ADMIN_REPORT_ROW_LIMIT = 5000;

export type ReportValueType = 'text' | 'date' | 'number' | 'boolean';

export interface AdminReportColumn {
  key: string;
  label: string;
  type: ReportValueType;
}

export interface AdminReportResult {
  type: AdminReportQuery['type'];
  title: string;
  generatedAt: string;
  period: { startDate: string | null; endDate: string | null; endDateInclusive: true; timeZone: 'database session timezone' };
  filters: Omit<AdminReportQuery, 'type'>;
  summary: Array<{ label: string; value: string | number }>;
  columns: AdminReportColumn[];
  rows: Array<Record<string, unknown>>;
  totalRecords: number;
  includedRecords: number;
  truncated: boolean;
  notes: string[];
}

interface ReportContent {
  rows: Array<Record<string, unknown>>;
  totalRecords: number;
  truncated: boolean;
  summary: Array<{ label: string; value: string | number }>;
  columns: AdminReportColumn[];
  notes: string[];
}

export function selectAdminReportColumns(
  content: Pick<AdminReportResult, 'columns' | 'rows'>,
  selectedKeys: string[],
): Pick<AdminReportResult, 'columns' | 'rows'> {
  if (selectedKeys.length === 0 || new Set(selectedKeys).size !== selectedKeys.length) {
    throw new AdminError('Select one or more unique report fields.', 400);
  }
  const availableColumns = new Map(content.columns.map((column) => [column.key, column]));
  const unavailableColumn = selectedKeys.find((key) => !availableColumns.has(key));
  if (unavailableColumn) throw new AdminError(`The selected report field "${unavailableColumn}" is not available for this report.`, 400);
  const columns = selectedKeys.map((key) => {
    const column = availableColumns.get(key);
    if (!column) throw new AdminError(`The selected report field "${key}" is not available for this report.`, 400);
    return column;
  });

  return {
    columns,
    rows: content.rows.map((row) => Object.fromEntries(selectedKeys.map((key) => [key, row[key]]))),
  };
}

const titles: Record<AdminReportQuery['type'], string> = {
  'platform-overview': 'Platform Overview Report',
  'employer-verification': 'Employer Verification Report',
  'user-management': 'User Management Report',
  'jobs-moderation': 'Jobs & Moderation Report',
  applications: 'Applications Report',
  'audit-activity': 'Audit Activity Report',
  'system-health': 'System Health Report',
  'ai-integration-usage': 'AI & Integration Usage Report',
};

const verificationColumns: AdminReportColumn[] = [
  { key: 'companyName', label: 'Organization', type: 'text' },
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'contactEmail', label: 'Contact email', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'createdAt', label: 'Submitted at', type: 'date' },
  { key: 'reviewedAt', label: 'Decision at', type: 'date' },
  { key: 'reviewerName', label: 'Reviewed by', type: 'text' },
  { key: 'reviewNotes', label: 'Decision reason', type: 'text' },
];

const userColumns: AdminReportColumn[] = [
  { key: 'fullName', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'status', label: 'Account status', type: 'text' },
  { key: 'createdAt', label: 'Registered at', type: 'date' },
];

const jobColumns: AdminReportColumn[] = [
  { key: 'title', label: 'Job title', type: 'text' },
  { key: 'companyName', label: 'Employer', type: 'text' },
  { key: 'jobType', label: 'Job type', type: 'text' },
  { key: 'storedStatus', label: 'Stored status', type: 'text' },
  { key: 'effectiveStatus', label: 'Effective status', type: 'text' },
  { key: 'employerStatus', label: 'Employer approval', type: 'text' },
  { key: 'deadline', label: 'Deadline', type: 'date' },
  { key: 'createdAt', label: 'Posted at', type: 'date' },
  { key: 'applicantsCount', label: 'Applicants', type: 'number' },
];

const applicationColumns: AdminReportColumn[] = [
  { key: 'jobTitle', label: 'Job title', type: 'text' },
  { key: 'companyName', label: 'Employer', type: 'text' },
  { key: 'jobType', label: 'Job type', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'status', label: 'Application status', type: 'text' },
  { key: 'appliedAt', label: 'Applied at', type: 'date' },
  { key: 'matchScore', label: 'Match score (%)', type: 'number' },
];

const auditColumns: AdminReportColumn[] = [
  { key: 'createdAt', label: 'Timestamp', type: 'date' },
  { key: 'actorName', label: 'Actor', type: 'text' },
  { key: 'actorRole', label: 'Actor role', type: 'text' },
  { key: 'action', label: 'Event type', type: 'text' },
  { key: 'entityType', label: 'Target type', type: 'text' },
  { key: 'entityId', label: 'Target ID', type: 'text' },
  { key: 'outcome', label: 'Outcome', type: 'text' },
];

const systemColumns: AdminReportColumn[] = [
  { key: 'component', label: 'Component', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'detail', label: 'Details', type: 'text' },
];

const aiColumns: AdminReportColumn[] = [
  { key: 'provider', label: 'Provider', type: 'text' },
  { key: 'configured', label: 'Configured', type: 'boolean' },
  { key: 'availability', label: 'Availability', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'requests', label: 'Requests', type: 'number' },
  { key: 'fallbacks', label: 'Fallbacks', type: 'number' },
  { key: 'failures', label: 'Failures', type: 'number' },
  { key: 'averageLatencyMs', label: 'Average latency (ms)', type: 'number' },
];

function addDateFilters(column: string, filters: AdminReportQuery, conditions: string[], params: unknown[]): void {
  if (filters.startDate) {
    params.push(filters.startDate);
    conditions.push(`${column} >= $${params.length}`);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    conditions.push(`${column} < DATE_ADD($${params.length}, INTERVAL 1 DAY)`);
  }
}

function addTextFilter(conditions: string[], params: unknown[], column: string, value: string | undefined): void {
  if (!value) return;
  params.push(`%${value.toLowerCase()}%`);
  conditions.push(`LOWER(${column}) LIKE $${params.length}`);
}

function whereClause(conditions: string[]): string {
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

async function fetchLimited(
  countFrom: string,
  select: string,
  from: string,
  conditions: string[],
  params: unknown[],
  orderBy: string,
): Promise<Pick<ReportContent, 'rows' | 'totalRecords' | 'truncated'>> {
  const where = whereClause(conditions);
  const [countResult, result] = await Promise.all([
    db.query<{ count: number | string }>(`SELECT count(*) AS count ${countFrom} ${where}`, params),
    db.query(
      `${select} ${from} ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1}`,
      [...params, ADMIN_REPORT_ROW_LIMIT + 1],
    ),
  ]);
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  return { rows: result.rows.slice(0, ADMIN_REPORT_ROW_LIMIT), totalRecords, truncated: totalRecords > ADMIN_REPORT_ROW_LIMIT };
}

async function groupedCounts(
  column: string,
  from: string,
  conditions: string[],
  params: unknown[],
): Promise<Array<{ label: string; value: number }>> {
  const result = await db.query<{ label: string; count: number | string }>(
    `SELECT ${column} AS label, count(*) AS count ${from} ${whereClause(conditions)} GROUP BY ${column} ORDER BY ${column}`,
    params,
  );
  return result.rows.map((row) => ({ label: String(row.label ?? 'Unknown'), value: Number(row.count ?? 0) }));
}

function addGroupedSummary(summary: Array<{ label: string; value: string | number }>, title: string, groups: Array<{ label: string; value: number }>): void {
  for (const group of groups) summary.push({ label: `${title}: ${group.label}`, value: group.value });
}

async function platformOverview(filters: AdminReportQuery): Promise<ReportContent> {
  const metrics = await getAdminMetrics();
  const [verificationGroups, jobGroups, applicationGroups] = await Promise.all([
    groupedCounts(
      'evr.status',
      'FROM employer_verification_records evr JOIN employer_profiles e ON e.id = evr."employerId"',
      ['evr."archivedAt" IS NULL', 'e."archivedAt" IS NULL'],
      [],
    ),
    groupedCounts(
      `CASE WHEN j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE THEN 'EXPIRED' ELSE j.status END`,
      'FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"',
      ['j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'],
      [],
    ),
    groupedCounts(
      'ja.status',
      'FROM job_applications ja JOIN jobs j ON j.id = ja."jobId" JOIN employer_profiles e ON e.id = j."employerId"',
      ['ja."archivedAt" IS NULL', 'j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'],
      [],
    ),
  ]);
  const activities = [
    { label: 'New registrations', from: 'FROM users u', column: 'u.`createdAt`', conditions: ['u."archivedAt" IS NULL'] },
    { label: 'Verification submissions', from: 'FROM employer_verification_records evr JOIN employer_profiles e ON e.id = evr."employerId"', column: 'evr.`createdAt`', conditions: ['evr."archivedAt" IS NULL', 'e."archivedAt" IS NULL'] },
    { label: 'Job postings', from: 'FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"', column: 'j.`createdAt`', conditions: ['j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'] },
    { label: 'Applications', from: 'FROM job_applications ja JOIN jobs j ON j.id = ja."jobId" JOIN employer_profiles e ON e.id = j."employerId"', column: 'ja.`appliedAt`', conditions: ['ja."archivedAt" IS NULL', 'j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'] },
  ];
  const rows = await Promise.all(activities.map(async ({ label, from, column, conditions: baseConditions }) => {
    const conditions = [...baseConditions];
    const params: unknown[] = [];
    addDateFilters(column, filters, conditions, params);
    const result = await db.query<{ count: number | string }>(`SELECT count(*) AS count ${from} ${whereClause(conditions)}`, params);
    return { activity: label, count: Number(result.rows[0]?.count ?? 0) };
  }));
  const summary: Array<{ label: string; value: string | number }> = [
    { label: 'Registered candidates', value: metrics.registeredCandidates },
    { label: 'Employer organizations', value: metrics.totalEmployers },
    { label: 'Verified employers', value: metrics.verifiedEmployers },
    { label: 'Active candidates', value: metrics.activeCandidates },
    { label: 'Suspended candidates', value: metrics.suspendedCandidates },
    { label: 'New candidates in last 30 days', value: metrics.recentlyRegisteredCandidates },
  ];
  addGroupedSummary(summary, 'Verification submissions', verificationGroups);
  addGroupedSummary(summary, 'Job postings', jobGroups);
  addGroupedSummary(summary, 'Applications', applicationGroups);
  return {
    rows,
    totalRecords: rows.length,
    truncated: false,
    columns: [
      { key: 'activity', label: 'Reporting-period activity', type: 'text' },
      { key: 'count', label: 'Records', type: 'number' },
    ],
    summary,
    notes: ['Platform status totals are current all-time snapshots; reporting-period activity rows use the selected inclusive reporting period. Expired jobs are derived from active postings past their deadline.'],
  };
}

async function employerVerificationReport(filters: AdminReportQuery): Promise<ReportContent> {
  const conditions: string[] = ['evr."archivedAt" IS NULL', 'e."archivedAt" IS NULL', 'u."archivedAt" IS NULL'];
  const params: unknown[] = [];
  addDateFilters('evr.`createdAt`', filters, conditions, params);
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`evr.status = $${params.length}`);
  }
  addTextFilter(conditions, params, 'e.industry', filters.category);
  const from = `FROM employer_verification_records evr
    JOIN employer_profiles e ON evr."employerId" = e.id
    JOIN users u ON e."userId" = u.id
    LEFT JOIN users reviewer ON evr."reviewerAdminId" = reviewer.id`;
  const result = await fetchLimited(
    from,
    `SELECT e."companyName", e.industry, e.city, u.email AS "contactEmail", evr.status,
      evr."createdAt", evr."reviewedAt", reviewer."fullName" AS "reviewerName", evr."reviewNotes"`,
    from,
    conditions,
    params,
    'evr."createdAt" DESC',
  );
  const groups = await groupedCounts('evr.status', from, conditions, params);
  const summary: Array<{ label: string; value: string | number }> = [{ label: 'Matching submissions', value: result.totalRecords }];
  addGroupedSummary(summary, 'Status', groups);
  return { ...result, columns: verificationColumns, summary, notes: ['Submitted document URLs and identifiers are excluded because protected document delivery is not implemented. Review notes are restricted to authorized administrators.'] };
}

async function userManagementReport(filters: AdminReportQuery): Promise<ReportContent> {
  const conditions: string[] = ['u."archivedAt" IS NULL'];
  const params: unknown[] = [];
  addDateFilters('u.`createdAt`', filters, conditions, params);
  if (filters.role) {
    params.push(filters.role);
    conditions.push(`u.role = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status === 'active');
    conditions.push(`u."isActive" = $${params.length}`);
  }
  const from = 'FROM users u';
  const result = await fetchLimited(
    from,
    `SELECT u."fullName", u.email, u.role, CASE WHEN u."isActive" THEN 'active' ELSE 'suspended' END AS status, u."createdAt"`,
    from,
    conditions,
    params,
    'u."createdAt" DESC',
  );
  const roleGroups = await groupedCounts('u.role', from, conditions, params);
  const summary: Array<{ label: string; value: string | number }> = [{ label: 'Matching accounts', value: result.totalRecords }];
  addGroupedSummary(summary, 'Role', roleGroups);
  const auditConditions: string[] = [];
  const auditParams: unknown[] = [];
  addDateFilters('`createdAt`', filters, auditConditions, auditParams);
  auditConditions.push(`action IN ('USER_SUSPENDED', 'USER_ACTIVATED')`);
  const moderation = await db.query<{ action: string; count: number | string }>(
    `SELECT action, count(*) AS count FROM platform_audit_logs ${whereClause(auditConditions)} GROUP BY action`,
    auditParams,
  );
  for (const row of moderation.rows) summary.push({ label: String(row.action), value: Number(row.count ?? 0) });
  return { ...result, columns: userColumns, summary, notes: ['User report excludes phone numbers, profile data, password hashes, and authentication/session fields. Suspension/reactivation counts come from recorded audit events.'] };
}

async function jobsModerationReport(filters: AdminReportQuery): Promise<ReportContent> {
  const conditions: string[] = ['j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'];
  const params: unknown[] = [];
  addDateFilters('j.`createdAt`', filters, conditions, params);
  if (filters.status === 'EXPIRED') conditions.push(`j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE`);
  else if (filters.status === 'ACTIVE') conditions.push(`j.status = 'ACTIVE' AND (j.deadline IS NULL OR DATE(j.deadline) >= CURRENT_DATE)`);
  else if (filters.status) {
    params.push(filters.status);
    conditions.push(`j.status = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`j."jobType" = $${params.length}`);
  }
  const from = 'FROM jobs j JOIN employer_profiles e ON j."employerId" = e.id';
  const result = await fetchLimited(
    from,
    `SELECT j.title, e."companyName", j."jobType", j.status AS "storedStatus",
      CASE WHEN j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE THEN 'EXPIRED' ELSE j.status END AS "effectiveStatus",
      CASE WHEN e."isApproved" THEN 'approved' ELSE 'not approved' END AS "employerStatus", j.deadline, j."createdAt",
      (SELECT count(*) FROM job_applications ja WHERE ja."jobId" = j.id AND ja."archivedAt" IS NULL) AS "applicantsCount"`,
    from,
    conditions,
    params,
    'j."createdAt" DESC',
  );
  const groups = await groupedCounts(
    `CASE WHEN j.status = 'ACTIVE' AND j.deadline IS NOT NULL AND DATE(j.deadline) < CURRENT_DATE THEN 'EXPIRED' ELSE j.status END`,
    from,
    conditions,
    params,
  );
  const summary: Array<{ label: string; value: string | number }> = [{ label: 'Matching jobs', value: result.totalRecords }];
  addGroupedSummary(summary, 'Effective status', groups);
  const auditConditions = [`action = 'ADMIN_JOB_STATUS_CHANGED'`];
  const auditParams: unknown[] = [];
  addDateFilters('`createdAt`', filters, auditConditions, auditParams);
  const moderation = await db.query<{ count: number | string }>(
    `SELECT count(*) AS count FROM platform_audit_logs ${whereClause(auditConditions)}`,
    auditParams,
  );
  summary.push({ label: 'Admin moderation events in period', value: Number(moderation.rows[0]?.count ?? 0) });
  return { ...result, columns: jobColumns, summary, notes: ['Expired is derived from an ACTIVE record past its deadline. No deadline-edit endpoint exists, so expired jobs cannot be reactivated from the portal.'] };
}

async function applicationsReport(filters: AdminReportQuery): Promise<ReportContent> {
  const conditions: string[] = ['ja."archivedAt" IS NULL', 'j."archivedAt" IS NULL', 'e."archivedAt" IS NULL'];
  const params: unknown[] = [];
  addDateFilters('ja.`appliedAt`', filters, conditions, params);
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`ja.status = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`j."jobType" = $${params.length}`);
  }
  const from = `FROM job_applications ja
    JOIN jobs j ON ja."jobId" = j.id
    JOIN employer_profiles e ON j."employerId" = e.id`;
  const result = await fetchLimited(
    from,
    `SELECT j.title AS "jobTitle", e."companyName", j."jobType", j.city, ja.status, ja."appliedAt", ja."matchScore"`,
    from,
    conditions,
    params,
    'ja."appliedAt" DESC',
  );
  const groups = await groupedCounts('ja.status', from, conditions, params);
  const summary: Array<{ label: string; value: string | number }> = [{ label: 'Matching applications', value: result.totalRecords }];
  addGroupedSummary(summary, 'Status', groups);
  return { ...result, columns: applicationColumns, summary, notes: ['Candidate identity and profile data are excluded. Trend data is limited to applications stored with the selected applied-at date range.'] };
}

async function auditActivityReport(filters: AdminReportQuery): Promise<ReportContent> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  addDateFilters('pal.`createdAt`', filters, conditions, params);
  addTextFilter(conditions, params, 'u.`fullName`', filters.actor);
  if (filters.eventType) {
    params.push(filters.eventType);
    conditions.push(`pal.action = $${params.length}`);
  }
  if (filters.outcome) {
    const outcomeSql = `CASE WHEN pal.action LIKE '%APPROVED%' THEN 'approved' WHEN pal.action LIKE '%REJECTED%' THEN 'rejected' ELSE 'recorded' END`;
    params.push(filters.outcome);
    conditions.push(`${outcomeSql} = $${params.length}`);
  }
  const from = 'FROM platform_audit_logs pal LEFT JOIN users u ON pal.`userId` = u.id';
  const result = await fetchLimited(
    from,
    `SELECT pal."createdAt", u."fullName" AS "actorName", u.role AS "actorRole", pal.action,
      pal."entityType", pal."entityId",
      CASE WHEN pal.action LIKE '%APPROVED%' THEN 'approved' WHEN pal.action LIKE '%REJECTED%' THEN 'rejected' ELSE 'recorded' END AS outcome`,
    from,
    conditions,
    params,
    'pal."createdAt" DESC',
  );
  return { ...result, columns: auditColumns, summary: [{ label: 'Matching audit events', value: result.totalRecords }], notes: ['Free-form details are omitted; credentials, request headers, tokens, and session identifiers are never exported.'] };
}

async function currentSystemReport(type: 'system-health' | 'ai-integration-usage'): Promise<ReportContent> {
  const system = await getSystemStatus();
  if (type === 'system-health') {
    const providerRows = Object.entries(system.aiProviders.providers).map(([provider, status]) => ({
      component: `${provider} model access`,
      status: status.configured ? status.availability : 'not-configured',
      detail: status.configured ? 'Configured model access check' : 'Optional provider is not configured',
    }));
    const rows = [
      { component: 'Application', status: system.status, detail: 'Current diagnostic result' },
      { component: 'Database', status: system.database.connected ? 'connected' : 'disconnected', detail: system.database.type },
      { component: 'Migrations', status: system.database.migrations.status, detail: `${system.database.migrations.appliedCount ?? 'unknown'} / ${system.database.migrations.expectedCount} applied` },
      ...providerRows,
    ];
    return {
      rows,
      totalRecords: rows.length,
      truncated: false,
      columns: systemColumns,
      summary: [{ label: 'Application', value: system.status }, { label: 'Database', value: system.database.connected ? 'Connected' : 'Disconnected' }, { label: 'Migrations', value: system.database.migrations.status }],
      notes: [`Point-in-time diagnostic at ${system.timestamp}. Date filters do not create historical health data. Infrastructure versions, addresses, and table inventory are excluded.`],
    };
  }
  const rows = (['openai', 'gemini'] as const).map((provider) => {
    const status = system.aiProviders.providers[provider];
    const usage = system.aiProviders.usage[provider];
    return {
      provider,
      configured: status.configured,
      availability: status.configured ? status.availability : 'not-configured',
      model: status.model,
      requests: usage.requests,
      fallbacks: usage.fallbacks,
      failures: usage.failures,
      averageLatencyMs: usage.requests ? usage.averageLatencyMs : null,
    };
  });
  return {
    rows,
    totalRecords: rows.length,
    truncated: false,
    columns: aiColumns,
    summary: [
      { label: 'Measured requests since backend start', value: rows.reduce((sum, row) => sum + row.requests, 0) },
      { label: 'Measured failures since backend start', value: rows.reduce((sum, row) => sum + row.failures, 0) },
      { label: 'Configured providers', value: rows.filter((row) => row.configured).length },
    ],
    notes: [`Point-in-time provider usage at ${system.timestamp}; counters reset on backend restart. Date filters do not create historical metrics. Token counts, costs, and historical activity are not recorded or estimated.`],
  };
}

export async function getAdminReport(filters: AdminReportQuery): Promise<AdminReportResult> {
  let content: ReportContent;
  switch (filters.type) {
    case 'platform-overview': content = await platformOverview(filters); break;
    case 'employer-verification': content = await employerVerificationReport(filters); break;
    case 'user-management': content = await userManagementReport(filters); break;
    case 'jobs-moderation': content = await jobsModerationReport(filters); break;
    case 'applications': content = await applicationsReport(filters); break;
    case 'audit-activity': content = await auditActivityReport(filters); break;
    case 'system-health':
    case 'ai-integration-usage': content = await currentSystemReport(filters.type); break;
  }
  if (filters.columns) {
    content = { ...content, ...selectAdminReportColumns(content, filters.columns) };
  }
  return {
    type: filters.type,
    title: titles[filters.type],
    generatedAt: new Date().toISOString(),
    period: { startDate: filters.startDate ?? null, endDate: filters.endDate ?? null, endDateInclusive: true, timeZone: 'database session timezone' },
    filters: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.status,
      role: filters.role,
      category: filters.category,
      actor: filters.actor,
      eventType: filters.eventType,
      outcome: filters.outcome,
    },
    ...content,
    includedRecords: content.rows.length,
  };
}