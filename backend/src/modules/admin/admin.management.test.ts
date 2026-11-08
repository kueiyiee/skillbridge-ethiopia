import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminManagementCreateSchema,
  adminManagementEntitySchema,
  adminManagementQuerySchema,
  adminManagementUpdateSchema,
} from './admin.management.schemas';

test('admin management exposes only supported platform record types', () => {
  for (const entity of ['users', 'employers', 'jobs', 'verifications', 'applications']) {
    assert.equal(adminManagementEntitySchema.safeParse(entity).success, true);
  }
  assert.equal(adminManagementEntitySchema.safeParse('audit-logs').success, false);
});

test('admin management queries are paginated and archive inclusion is explicit', () => {
  assert.deepEqual(adminManagementQuerySchema.parse({}), {
    page: 1,
    pageSize: 25,
    search: '',
    includeArchived: false,
  });
  assert.equal(adminManagementQuerySchema.parse({ includeArchived: 'true' }).includeArchived, true);
  assert.equal(adminManagementQuerySchema.safeParse({ pageSize: 1000 }).success, false);
});

test('admin-created accounts require strong passwords and cannot create admins', () => {
  assert.equal(adminManagementCreateSchema.safeParse({
    entity: 'users',
    data: { fullName: 'Test Candidate', email: 'candidate@example.test', role: 'JOB_SEEKER', password: 'long-password-123' },
  }).success, true);
  assert.equal(adminManagementCreateSchema.safeParse({
    entity: 'users',
    data: { fullName: 'Admin User', email: 'admin@example.test', role: 'ADMIN', password: 'long-password-123' },
  }).success, false);
  assert.equal(adminManagementCreateSchema.safeParse({
    entity: 'users',
    data: { fullName: 'Test Candidate', email: 'candidate@example.test', role: 'JOB_SEEKER', password: 'short' },
  }).success, false);
});

test('verification records cannot be created or edited through data management', () => {
  assert.equal(adminManagementCreateSchema.safeParse({
    entity: 'verifications',
    data: { employerId: 'emp-1', tinNumber: 'tin', businessLicenseNo: 'license', status: 'PENDING' },
  }).success, false);
  assert.equal(adminManagementUpdateSchema.safeParse({
    entity: 'verifications',
    data: { status: 'APPROVED', reviewNotes: 'Reviewed license.' },
  }).success, false);
});

test('applications enforce match-score bounds', () => {
  assert.equal(adminManagementCreateSchema.safeParse({
    entity: 'applications',
    data: { jobId: 'job-1', jobSeekerId: 'prof-1', status: 'APPLIED', matchScore: 101 },
  }).success, false);
});
