import { assertCanModerateUser, assertRecordUpdated } from './admin.policy';
import { AdminError } from './admin.errors';
import {
  listAuditLogs,
  listAdminJobs,
  listUsers,
  listVerifications,
  getEmployerVerificationSummary,
  moderateAdminJob as persistAdminJobModeration,
  moderateUser as persistModeration,
  readMetricCounts,
  reviewVerification as persistVerificationReview,
} from './admin.repository';
import type { AdminActor, AdminJobModerationInput, UserModerationInput, VerificationReviewInput } from './admin.types';

export { listAuditLogs, listUsers, listVerifications, getEmployerVerificationSummary };
export { listAdminJobs };

export async function moderateAdminJob(jobId: string, admin: AdminActor, input: AdminJobModerationInput) {
  const result = await persistAdminJobModeration(jobId, admin, input);
  if (result === 'not_found') assertRecordUpdated(false, 'Job not found.');
  if (result === 'expired') throw new AdminError('An expired job cannot be reactivated. Update its deadline before republishing.', 409);
  if (result === 'unverified') throw new AdminError('A job cannot be published until its employer is approved.', 409);
  return { message: result === 'unchanged' ? 'Job already has that status.' : `Job status updated to ${input.status}.` };
}

export async function reviewVerification(recordId: string, admin: AdminActor, input: VerificationReviewInput) {
  const result = await persistVerificationReview(recordId, admin, input);
  if (result === 'not_found') assertRecordUpdated(false, 'Verification record not found');
  if (result === 'conflict') throw new AdminError('This verification has already been finalized and cannot be changed.', 409);
  if (result === 'email_unverified') throw new AdminError('Verify the employer account email before approving its business verification.', 409);
  if (result === 'email_verification_action_required') throw new AdminError('The account email verification evidence requires review before business approval.', 409);
  if (result === 'requirements_incomplete') throw new AdminError('Required business identifiers are missing; approval cannot be recorded.', 409);
  if (result === 'documents_incomplete') throw new AdminError('Review and approve every submitted verification document before approving the employer.', 409);
  return {
    message: `Verification determination recorded: ${input.status}`,
    disclaimer: 'Platform verification represents internal review of submitted business credentials and does not constitute a government or legal guarantee.',
  };
}

export async function moderateUser(targetId: string, admin: AdminActor, input: UserModerationInput) {
  assertCanModerateUser(admin.userId, targetId, input.isActive);
  const result = await persistModeration(targetId, admin, input);
  if (result === 'not_found') assertRecordUpdated(false, 'User not found.');
  if (result === 'last_admin') throw new AdminError('Cannot suspend the last active administrator.', 409);
  return { message: `User status updated to ${input.isActive ? 'active' : 'suspended'}` };
}

function count(value: unknown): number {
  return Number.parseInt(String(value ?? '0'), 10) || 0;
}

export async function getAdminMetrics() {
  const values = await readMetricCounts();
  const candidateStats = values.candidates.rows[0];
  const employerStats = values.employers.rows[0];
  const verificationStats = values.verifications.rows[0];
  const jobStats = values.jobs.rows[0];
  const applicationStats = values.applications.rows[0];
  const averageMatchScore = applicationStats?.avg_score == null
    ? null
    : Math.round(Number.parseFloat(String(applicationStats.avg_score)));

  return {
    registeredCandidates: count(candidateStats?.count),
    activeCandidates: count(candidateStats?.active_count),
    suspendedCandidates: count(candidateStats?.suspended_count),
    recentlyRegisteredCandidates: count(candidateStats?.recent_count),
    totalEmployers: count(employerStats?.count),
    verifiedEmployers: count(employerStats?.approved_count),
    pendingEmployers: count(verificationStats?.pending_count),
    rejectedEmployers: count(verificationStats?.rejected_count),
    resubmissionRequiredEmployers: count(verificationStats?.resubmission_count),
    totalJobs: count(jobStats?.active_count),
    draftJobs: count(jobStats?.draft_count),
    pausedJobs: count(jobStats?.paused_count),
    closedJobs: count(jobStats?.closed_count),
    expiredJobs: count(jobStats?.expired_count),
    totalApplications: count(applicationStats?.count),
    applicationsAwaitingReview: count(applicationStats?.applied_count),
    applicationsInReview: count(applicationStats?.in_review_count),
    applicationsOffered: count(applicationStats?.offered_count),
    applicationsRejected: count(applicationStats?.rejected_count),
    applicationsWithdrawn: count(applicationStats?.withdrawn_count),
    averageMatchScore,
    evaluationsCompleted: count(values.evaluations.rows[0]?.count),
  };
}
