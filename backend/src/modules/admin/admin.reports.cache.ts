import { randomUUID } from 'node:crypto';
import type { AdminReportResult } from './admin.reports';

const snapshotTtlMs = 5 * 60_000;
const maximumSnapshots = 50;
const maximumSnapshotBytes = 12 * 1024 * 1024;
const maximumCacheBytes = 64 * 1024 * 1024;

interface ReportSnapshot {
  adminId: string;
  report: AdminReportResult;
  expiresAt: number;
  bytes: number;
}

const snapshots = new Map<string, ReportSnapshot>();
let cacheBytes = 0;

function removeExpired(now: number): void {
  for (const [id, snapshot] of snapshots) {
    if (snapshot.expiresAt <= now) {
      snapshots.delete(id);
      cacheBytes -= snapshot.bytes;
    }
  }
}

export function createAdminReportSnapshot(adminId: string, report: AdminReportResult, now = Date.now()): string | undefined {
  removeExpired(now);
  const bytes = Buffer.byteLength(JSON.stringify(report), 'utf8');
  if (bytes > maximumSnapshotBytes) return undefined;
  while (snapshots.size >= maximumSnapshots || cacheBytes + bytes > maximumCacheBytes) {
    const oldestId = snapshots.keys().next().value;
    if (!oldestId) break;
    const oldest = snapshots.get(oldestId);
    snapshots.delete(oldestId);
    cacheBytes -= oldest?.bytes ?? 0;
  }
  const snapshotId = randomUUID();
  snapshots.set(snapshotId, { adminId, report, expiresAt: now + snapshotTtlMs, bytes });
  cacheBytes += bytes;
  return snapshotId;
}

export function getAdminReportSnapshot(snapshotId: string, adminId: string, now = Date.now()): AdminReportResult | undefined {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot) return undefined;
  if (snapshot.expiresAt <= now) {
    snapshots.delete(snapshotId);
    cacheBytes -= snapshot.bytes;
    return undefined;
  }
  if (snapshot.adminId !== adminId) return undefined;
  return snapshot.report;
}

export function resetAdminReportSnapshotsForTest(): void {
  snapshots.clear();
  cacheBytes = 0;
}