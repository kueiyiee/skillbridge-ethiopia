import assert from 'node:assert/strict';
import test from 'node:test';
import { adminAuditQuerySchema, adminJobsQuerySchema, adminJobModerationSchema, adminReportExportSchema, adminReportQuerySchema, adminUsersQuerySchema, userModerationSchema, verificationReviewSchema } from './admin.schemas';
import { adminEmailVerificationReasonSchema } from './admin.email-verification.schemas';
import { assertCanModerateUser, getAdminEmailVerificationStatus, getEmployerApprovalBlock, isLastActiveAdministrator } from './admin.policy';
import { selectAdminReportColumns } from './admin.reports';

test('admin list filters default to bounded first pages', () => {
  assert.deepEqual(adminUsersQuerySchema.parse({}), { page: 1, pageSize: 25, search: '' });
  assert.equal(adminUsersQuerySchema.parse({ emailStatus: 'unverified' }).emailStatus, 'unverified');
  assert.equal(adminUsersQuerySchema.parse({ emailStatus: 'action_required' }).emailStatus, 'action_required');
  assert.equal(adminUsersQuerySchema.parse({ status: 'pending_verification' }).status, 'pending_verification');
  assert.equal(adminUsersQuerySchema.safeParse({ emailStatus: 'pending' }).success, false);
  assert.deepEqual(adminAuditQuerySchema.parse({}), { page: 1, pageSize: 25, search: '' });
  assert.equal(adminUsersQuerySchema.safeParse({ page: 0 }).success, false);
  assert.equal(adminAuditQuerySchema.safeParse({ pageSize: 101 }).success, false);
});

test('manual employer email verification requires a bounded reason', () => {
  assert.equal(adminEmailVerificationReasonSchema.safeParse({ reason: 'Reviewed account evidence' }).success, true);
  assert.equal(adminEmailVerificationReasonSchema.safeParse({ reason: ' ' }).success, false);
  assert.equal(adminEmailVerificationReasonSchema.safeParse({ reason: 'x'.repeat(501) }).success, false);
});

test('email verification directory distinguishes verified, pending, and inconsistent evidence', () => {
  assert.equal(getAdminEmailVerificationStatus(true, 'email_otp', new Date(), null), 'verified');
  assert.equal(getAdminEmailVerificationStatus(true, null, null, null), 'action_required');
  assert.equal(getAdminEmailVerificationStatus(false, null, null, null), 'unverified');
  assert.equal(getAdminEmailVerificationStatus(false, null, null, new Date()), 'action_required');
  assert.equal(getAdminEmailVerificationStatus(false, 'email_otp', null, null), 'action_required');
  assert.equal(getAdminEmailVerificationStatus(true, 'unknown', null, null), 'action_required');
  assert.equal(getAdminEmailVerificationStatus(false, null, null, null, true), 'action_required');
});

test('audit time filters reject reversed ranges', () => {
  assert.equal(adminAuditQuerySchema.safeParse({ from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' }).success, false);
  assert.equal(adminAuditQuerySchema.safeParse({ from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' }).success, true);
});

test('moderation prevents self-suspension and removing the last active administrator', () => {
  assert.throws(() => assertCanModerateUser('admin-1', 'admin-1', false));
  assert.equal(isLastActiveAdministrator('ADMIN', true, 1), true);
  assert.equal(isLastActiveAdministrator('ADMIN', true, 2), false);
  assert.equal(isLastActiveAdministrator('JOB_SEEKER', true, 1), false);
  assert.equal(isLastActiveAdministrator('ADMIN', false, 0), false);
});

test('business approval requires verified email, complete identifiers, and reviewed documents', () => {
  assert.equal(getEmployerApprovalBlock(false, '12345678', 'LICENSE'), 'email_unverified');
  assert.equal(getEmployerApprovalBlock(true, null, 'LICENSE'), 'requirements_incomplete');
  assert.equal(getEmployerApprovalBlock(true, '12345678', ''), 'requirements_incomplete');
  assert.equal(getEmployerApprovalBlock(true, ' 12345678 ', ' LICENSE ', false), 'documents_incomplete');
  assert.equal(getEmployerApprovalBlock(true, ' 12345678 ', ' LICENSE '), null);
});

test('verification determinations require bounded review notes', () => {
  assert.equal(verificationReviewSchema.safeParse({ status: 'REJECTED', reviewNotes: 'Review reason' }).success, true);
  assert.equal(verificationReviewSchema.safeParse({ status: 'REJECTED', reviewNotes: '  ' }).success, false);
  assert.equal(verificationReviewSchema.safeParse({ status: 'REJECTED', reviewNotes: 'x'.repeat(1001) }).success, false);
});

test('user moderation requires a bounded non-empty reason', () => {
  assert.equal(userModerationSchema.safeParse({ isActive: false, reason: 'Policy violation' }).success, true);
  assert.equal(userModerationSchema.safeParse({ isActive: false }).success, false);
  assert.equal(userModerationSchema.safeParse({ isActive: false, reason: '  ' }).success, false);
  assert.equal(userModerationSchema.safeParse({ isActive: false, reason: 'x'.repeat(501) }).success, false);
});

test('admin job filters and status changes use supported job states and bounded reasons', () => {
  assert.equal(adminJobsQuerySchema.safeParse({ page: 1, status: 'EXPIRED' }).success, true);
  assert.equal(adminJobsQuerySchema.safeParse({ status: 'REMOVED' }).success, false);
  assert.equal(adminJobModerationSchema.safeParse({ status: 'PAUSED', reason: 'Policy review' }).success, true);
  assert.equal(adminJobModerationSchema.safeParse({ status: 'DRAFT', reason: 'Policy review' }).success, false);
  assert.equal(adminJobModerationSchema.safeParse({ status: 'CLOSED', reason: '  ' }).success, false);
});

test('admin report requests validate supported types, formats, and inclusive date ranges', () => {
  assert.equal(adminReportQuerySchema.safeParse({ type: 'applications', startDate: '2026-10-01', endDate: '2026-10-21' }).success, true);
  assert.equal(adminReportQuerySchema.safeParse({ type: 'invented-report' }).success, false);
  assert.equal(adminReportQuerySchema.safeParse({ type: 'audit-activity', startDate: '2026-10-21', endDate: '2026-10-01' }).success, false);
  assert.equal(adminReportQuerySchema.safeParse({ type: 'applications', role: 'ADMIN' }).success, false);
  assert.equal(adminReportQuerySchema.safeParse({ type: 'system-health', startDate: '2026-10-01' }).success, false);
  assert.deepEqual(adminReportQuerySchema.parse({ type: 'applications', columns: 'jobTitle,status' }).columns, ['jobTitle', 'status']);
  assert.equal(adminReportQuerySchema.safeParse({ type: 'applications', columns: 'status,status' }).success, false);
  assert.equal(adminReportQuerySchema.safeParse({ type: 'applications', columns: 'x'.repeat(1001) }).success, false);
  assert.equal(adminReportExportSchema.safeParse({ snapshotId: '550e8400-e29b-41d4-a716-446655440000', format: 'xlsx' }).success, true);
  assert.equal(adminReportExportSchema.safeParse({ type: 'platform-overview', format: 'xlsx' }).success, false);
  assert.equal(adminReportExportSchema.safeParse({ snapshotId: '550e8400-e29b-41d4-a716-446655440000', format: 'json' }).success, false);
});

test('admin report field selection applies to preview and export row shape', () => {
  const reportData = {
    columns: [
      { key: 'name', label: 'Name', type: 'text' as const },
      { key: 'email', label: 'Email', type: 'text' as const },
    ],
    rows: [{ name: 'Aster', email: 'aster@example.test' }],
  };
  assert.deepEqual(selectAdminReportColumns(reportData, ['email']).columns.map(({ key }) => key), ['email']);
  assert.deepEqual(selectAdminReportColumns(reportData, ['email']).rows, [{ email: 'aster@example.test' }]);
  assert.throws(() => selectAdminReportColumns(reportData, ['password']), { statusCode: 400 });
  assert.throws(() => selectAdminReportColumns(reportData, []), { statusCode: 400 });
});