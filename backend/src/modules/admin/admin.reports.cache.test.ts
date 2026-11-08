import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminReportSnapshot, getAdminReportSnapshot, resetAdminReportSnapshotsForTest } from './admin.reports.cache';
import type { AdminReportResult } from './admin.reports';

const report: AdminReportResult = {
  type: 'audit-activity',
  title: 'Audit Activity Report',
  generatedAt: '2026-10-21T10:00:00.000Z',
  period: { startDate: null, endDate: null, endDateInclusive: true, timeZone: 'database session timezone' },
  filters: {},
  summary: [],
  columns: [],
  rows: [],
  totalRecords: 0,
  includedRecords: 0,
  truncated: false,
  notes: [],
};

test('report snapshots are owner-scoped and expire after five minutes', () => {
  resetAdminReportSnapshotsForTest();
  const snapshotId = createAdminReportSnapshot('admin-1', report, 1000);
  assert.ok(snapshotId);
  assert.equal(getAdminReportSnapshot(snapshotId, 'admin-2', 2000), undefined);
  assert.equal(getAdminReportSnapshot(snapshotId, 'admin-1', 2000), report);
  assert.equal(getAdminReportSnapshot(snapshotId, 'admin-1', 301001), undefined);
});