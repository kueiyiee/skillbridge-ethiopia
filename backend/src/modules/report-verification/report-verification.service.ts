import { createHash, randomBytes } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';

export type ReportIssuerRole = 'ADMIN' | 'EMPLOYER';

export interface IssuedReportIdentity {
  id: string;
  verificationUrl: string;
  reportHash: string;
}

export interface PublicReportVerification {
  reportId: string;
  reportTitle: string;
  reportType: string;
  issuerRole: ReportIssuerRole;
  generatedAt: string;
  recordCount: number;
  reportHash: string;
  status: 'VALID' | 'REVOKED';
}

export async function issueReportIdentity(input: {
  issuerUserId: string;
  issuerRole: ReportIssuerRole;
  employerId?: string | null;
  reportType: string;
  reportTitle: string;
  generatedAt: string;
  recordCount: number;
  reportPayload: unknown;
}): Promise<IssuedReportIdentity> {
  const id = `RPT-${randomBytes(10).toString('hex').toUpperCase()}`;
  const reportHash = createHash('sha256').update(JSON.stringify(input.reportPayload)).digest('hex');
  const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (!baseUrl) throw new Error('PUBLIC_APP_URL (or APP_URL) must be configured before issuing verifiable PDF reports.');
  let parsedBase: URL;
  try {
    parsedBase = new URL(baseUrl);
  } catch {
    throw new Error('PUBLIC_APP_URL must be a valid absolute URL.');
  }
  if (process.env.NODE_ENV === 'production' && parsedBase.protocol !== 'https:') {
    throw new Error('Verifiable report links require HTTPS in production.');
  }
  const verificationUrl = new URL(`/verify-report/${encodeURIComponent(id)}`, parsedBase).toString();

  await db.query(
    `INSERT INTO issued_reports
      (id, issuerUserId, issuerRole, employerId, reportType, reportTitle, generatedAt, reportHash, recordCount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'VALID')`,
    [id, input.issuerUserId, input.issuerRole, input.employerId ?? null, input.reportType, input.reportTitle, input.generatedAt, reportHash, Math.max(0, Math.trunc(input.recordCount))],
  );
  return { id, verificationUrl, reportHash };
}

export async function getPublicReportVerification(id: string): Promise<PublicReportVerification | null> {
  const result = await db.query<{
    id: string;
    reportTitle: string;
    reportType: string;
    issuerRole: ReportIssuerRole;
    generatedAt: Date | string;
    recordCount: number | string;
    reportHash: string;
    status: 'VALID' | 'REVOKED';
  }>(
    `SELECT id, reportTitle, reportType, issuerRole, generatedAt, recordCount, reportHash, status
     FROM issued_reports WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    reportId: row.id,
    reportTitle: row.reportTitle,
    reportType: row.reportType,
    issuerRole: row.issuerRole,
    generatedAt: row.generatedAt instanceof Date ? row.generatedAt.toISOString() : new Date(row.generatedAt).toISOString(),
    recordCount: Number(row.recordCount),
    reportHash: row.reportHash,
    status: row.status,
  };
}
