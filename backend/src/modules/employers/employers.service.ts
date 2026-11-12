import { randomUUID } from 'node:crypto';
import { assertApplicationManaged, assertEmployerExists, assertEmployerIsVerified } from './employers.policy';
import { EmployerError } from './employers.errors';
import {
  applicationBelongsToEmployer,
  getDiscoverableCandidateDetails,
  findEmployer,
  getLatestVerification,
  getEmployerReport as readEmployerReport,
  listApplicationsForEmployer,
  listEmployerJobs,
  listPublicEmployers,
  readAnalyticsData,
  searchDiscoverableCandidates,
  submitVerification as persistVerification,
  updateApplicationStatus as persistApplicationStatus,
} from './employers.repository';
import type {
  ApplicationStatusInput,
  CandidateSearchInput,
  EmployerActor,
  EmployerReportQuery,
  EmployerReportType,
  VerificationSubmissionInput,
} from './employers.types';

export async function getPublicEmployers() {
  const employers = await listPublicEmployers();
  return employers.map((employer) => ({
    ...employer,
    verificationStatus: employer.isApproved ? 'VERIFIED' : 'PENDING',
  }));
}

export async function getEmployerDashboard(actor: EmployerActor) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer), 'Employer organization profile not found');
  const [verification, jobs] = await Promise.all([
    getLatestVerification(String(employer!.id)),
    listEmployerJobs(String(employer!.id)),
  ]);
  return {
    ...employer,
    verificationStatus: employer!.isApproved
      ? 'VERIFIED'
      : verification?.status === 'APPROVED'
        ? 'RESUBMISSION_REQUIRED'
        : (verification?.status || 'NOT_SUBMITTED'),
    verification: verification || null,
    jobs,
  };
}

export async function submitEmployerVerification(actor: EmployerActor, input: VerificationSubmissionInput) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  const recordId = `ver-${randomUUID()}`;
  await persistVerification(recordId, actor, String(employer!.id), input);
  return { recordId, status: 'PENDING' };
}

export async function getEmployerApplications(actor: EmployerActor) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  return listApplicationsForEmployer(String(employer!.id));
}

export async function searchEmployerCandidates(actor: EmployerActor, filters: CandidateSearchInput) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  const result = await searchDiscoverableCandidates(actor.userId, filters);
  return {
    data: result.candidates,
    count: result.candidates.length,
    total: result.total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(result.total / filters.pageSize),
  };
}

export async function getEmployerCandidateDetails(actor: EmployerActor, profileId: string) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  const candidate = await getDiscoverableCandidateDetails(actor.userId, profileId);
  if (!candidate) throw new EmployerError('Candidate profile not found or not available for discovery.', 404);
  return candidate;
}

async function getVerifiedEmployerId(actor: EmployerActor) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  return String(employer!.id);
}

export async function getEmployerReportPreview(
  actor: EmployerActor,
  type: EmployerReportType,
  filters: EmployerReportQuery,
) {
  const employerId = await getVerifiedEmployerId(actor);
  const report = await readEmployerReport(employerId, type, filters);
  return {
    type,
    generatedAt: new Date().toISOString(),
    period: { startDate: filters.startDate ?? null, endDate: filters.endDate ?? null },
    page: filters.page,
    pageSize: filters.pageSize,
    totalRecords: report.total,
    totalPages: Math.ceil(report.total / filters.pageSize),
    summary: report.summary,
    columns: report.columns,
    rows: report.rows,
  };
}

export async function getEmployerReportExport(
  actor: EmployerActor,
  type: EmployerReportType,
  filters: Pick<EmployerReportQuery, 'startDate' | 'endDate'>,
) {
  const employerId = await getVerifiedEmployerId(actor);
  const report = await readEmployerReport(employerId, type, {
    ...filters,
    page: 1,
    pageSize: 100,
  }, true);
  return { ...report, employerId };
}

export async function updateEmployerApplicationStatus(
  applicationId: string,
  actor: EmployerActor,
  input: ApplicationStatusInput,
) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  assertApplicationManaged(await applicationBelongsToEmployer(applicationId, actor.userId));
  await persistApplicationStatus(applicationId, actor, input);
  return { message: `Application stage transitioned to ${input.status}` };
}

export function countEmployerJobStatus(
  jobs: ReadonlyArray<{ status?: string; effectiveStatus?: string }>,
  status: string,
): number {
  return jobs.filter((job) => (job.effectiveStatus ?? job.status) === status).length;
}

export async function getEmployerAnalytics(actor: EmployerActor) {
  const employer = await findEmployer(actor.userId);
  assertEmployerExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  const data = await readAnalyticsData(String(employer!.id));
  const totalJobsPublished = data.jobs.length;
  const totalApplications = data.applications.length;
  const statusDistribution: Record<string, number> = {
    APPLIED: 0,
    SCREENING: 0,
    SHORTLISTED: 0,
    TECHNICAL_ASSESSMENT: 0,
    INTERVIEW_SCHEDULED: 0,
    OFFERED: 0,
    HIRED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };

  let totalResponseTimeMs = 0;
  let reviewedCount = 0;
  let reviewedWithDiffCount = 0;
  let sumMatchScore = 0;
  for (const application of data.applications) {
    statusDistribution[application.status] = (statusDistribution[application.status] ?? 0) + 1;
    sumMatchScore += application.matchScore || 0;
    const isReviewed = application.status !== 'APPLIED' || Boolean(application.statusNotes?.trim());
    if (!isReviewed) continue;
    reviewedCount += 1;
    const appliedTime = new Date(application.appliedAt).getTime();
    const updatedTime = new Date(application.updatedAt).getTime();
    if (updatedTime > appliedTime) {
      totalResponseTimeMs += updatedTime - appliedTime;
      reviewedWithDiffCount += 1;
    }
  }

  const responseRate = totalApplications > 0 ? Math.round((reviewedCount / totalApplications) * 100) : 0;
  let avgResponseTimeHours: number | null = null;
  let avgResponseTimeDisplay = 'N/A (No reviewed applications yet)';
  if (reviewedWithDiffCount > 0) {
    avgResponseTimeHours = Number((totalResponseTimeMs / reviewedWithDiffCount / (1000 * 60 * 60)).toFixed(1));
    avgResponseTimeDisplay = avgResponseTimeHours < 24
      ? `${avgResponseTimeHours} hours`
      : `${(avgResponseTimeHours / 24).toFixed(1)} days`;
  } else if (reviewedCount > 0) {
    avgResponseTimeDisplay = '< 1 hour (Instant review)';
  }

  const confirmedOffersCount = statusDistribution.OFFERED || 0;
  const requiredSkillIds = new Set(data.requiredSkills.map((skill) => skill.skillId));
  const coveredSkillCount = data.applicantSkills.filter((skill) => requiredSkillIds.has(skill.skillId)).length;
  const candidateSkillCoveragePct = requiredSkillIds.size > 0 ? Math.round((coveredSkillCount / requiredSkillIds.size) * 100) : 0;

  return {
    summary: {
      totalJobsPublished,
      activeJobsCount: countEmployerJobStatus(data.jobs, 'ACTIVE'),
      draftJobsCount: countEmployerJobStatus(data.jobs, 'DRAFT'),
      closedJobsCount: countEmployerJobStatus(data.jobs, 'CLOSED'),
      pausedJobsCount: countEmployerJobStatus(data.jobs, 'PAUSED'),
      expiredJobsCount: countEmployerJobStatus(data.jobs, 'EXPIRED'),
      totalApplications,
      reviewedApplications: reviewedCount,
      responseRate,
      avgResponseTimeHours,
      avgResponseTimeDisplay,
      avgMatchScore: totalApplications > 0 ? Math.round(sumMatchScore / totalApplications) : 0,
      confirmedOffersCount,
      interviewsScheduledCount: statusDistribution.INTERVIEW_SCHEDULED || 0,
      hireConversionRate: totalApplications > 0 ? Number(((confirmedOffersCount / totalApplications) * 100).toFixed(1)) : 0,
      candidateSkillCoveragePct,
      totalUniqueSkillsRequired: requiredSkillIds.size,
      skillsCoveredByApplicants: coveredSkillCount,
    },
    statusDistribution,
    sampleSizeContext: `Based on ${totalApplications} application(s) across ${totalJobsPublished} vacancy listing(s).`,
    dataNotice: totalApplications > 0
      ? 'Calculated from actual database application records.'
      : 'Zero applications recorded yet. Publish jobs and invite candidate applications to generate live performance analytics.',
    definitions: {
      responseRate: 'Percentage of candidate applications that have received status progression (beyond APPLIED) or reviewer feedback notes.',
      avgResponseTime: 'Mean elapsed time between application submission timestamp and employer status decision timestamp.',
      candidateSkillCoverage: 'Percentage of employer-specified required skill competencies possessed by current applicants.',
      statusDistribution: 'Frequency of candidate applications currently in each recruitment pipeline stage.',
    },
  };
}
