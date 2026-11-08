import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../../infrastructure/database/drizzle';
import type { AuthActor } from '../auth/auth.types';
import type {
  EmployerVerificationDocumentCategory,
  EmployerVerificationDocumentReview,
} from './verification-documents.schemas';

const maxDocumentBytes = 4 * 1024 * 1024;

export interface DocumentPayload {
  category: EmployerVerificationDocumentCategory;
  originalFilename: string;
  contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  data: string;
}

export interface StoredVerificationDocument {
  id: string;
  employerId: string;
  verificationRecordId: string;
  category: EmployerVerificationDocumentCategory;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  reviewNotes: string | null;
  submittedAt: Date | string;
  reviewedAt: Date | string | null;
  reviewerName?: string | null;
}

export class VerificationDocumentError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export function verificationDocumentDirectory(): string {
  return path.resolve(process.env.EMPLOYER_VERIFICATION_DOCUMENT_DIRECTORY || path.join(process.cwd(), 'data', 'private', 'employer-verification-documents'));
}

export function safeDocumentFilename(value: string): string {
  const filename = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
    .slice(0, 255);
  return filename || 'verification-document';
}

export function inspectVerificationDocument(bytes: Buffer): { extension: 'pdf' | 'jpg' | 'png'; contentType: string } | null {
  if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') {
    return { extension: 'pdf', contentType: 'application/pdf' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', contentType: 'image/png' };
  }
  return null;
}

function decodeDocument(payload: DocumentPayload): { bytes: Buffer; extension: 'pdf' | 'jpg' | 'png' } {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.data)) {
    throw new VerificationDocumentError('The document data is invalid.', 400);
  }
  const bytes = Buffer.from(payload.data, 'base64');
  if (!bytes.length || bytes.length > maxDocumentBytes) {
    throw new VerificationDocumentError('Documents must be 4 MB or smaller.', 413);
  }
  if (bytes.toString('base64') !== payload.data) {
    throw new VerificationDocumentError('The document data is invalid.', 400);
  }
  const detected = inspectVerificationDocument(bytes);
  if (!detected || detected.contentType !== payload.contentType) {
    throw new VerificationDocumentError('Only valid PDF, JPG, or PNG files with matching file content are supported.', 415);
  }
  return { bytes, extension: detected.extension };
}

function audit(
  query: (sql: string, params?: unknown[]) => Promise<unknown>,
  actorId: string,
  action: string,
  entityId: string,
  details: string,
) {
  return query(
    `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
     VALUES ($1, $2, $3, 'EmployerVerificationDocument', $4, $5)`,
    [`audit-${randomUUID()}`, actorId, action, entityId, details.slice(0, 1000)],
  );
}

export async function uploadEmployerVerificationDocument(actor: AuthActor, payload: DocumentPayload) {
  const { bytes, extension } = decodeDocument(payload);
  const storageKey = `${randomUUID()}.${extension}`;
  const storagePath = path.join(verificationDocumentDirectory(), storageKey);
  await mkdir(verificationDocumentDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(storagePath, bytes, { flag: 'wx', mode: 0o600 });

  try {
    const document = await db.transaction(async ({ query }) => {
      const employer = await query<{ id: string; emailVerified: boolean }>(
        `SELECT e.id, u."emailVerified" FROM employer_profiles e
         JOIN users u ON u.id = e."userId"
         WHERE u.id = $1 AND u.role = 'EMPLOYER' AND u."archivedAt" IS NULL
           AND e."archivedAt" IS NULL FOR UPDATE`,
        [actor.userId],
      );
      if (!employer.rows[0]) throw new VerificationDocumentError('Employer profile not found.', 404);
      if (!employer.rows[0].emailVerified) {
        throw new VerificationDocumentError('Verify your account email before uploading business documents.', 403);
      }
      const verification = await query<{ id: string; status: string }>(
        `SELECT id, status FROM employer_verification_records
         WHERE "employerId" = $1 AND "archivedAt" IS NULL
         ORDER BY "createdAt" DESC, id DESC LIMIT 1 FOR UPDATE`,
        [employer.rows[0].id],
      );
      const record = verification.rows[0];
      if (!record) throw new VerificationDocumentError('Submit your business identifiers before uploading supporting documents.', 409);
      if (record.status === 'APPROVED' || record.status === 'REJECTED') {
        throw new VerificationDocumentError('Resubmit your business details before uploading documents for a new review.', 409);
      }
      const id = `evd-${randomUUID()}`;
      const originalFilename = safeDocumentFilename(payload.originalFilename);
      const replaceable = await query<{ id: string }>(
        `SELECT id FROM employer_verification_documents
         WHERE "employerId" = $1 AND "verificationRecordId" = $2 AND category = $3
           AND status IN ('REJECTED', 'RESUBMISSION_REQUIRED') AND "archivedAt" IS NULL
         FOR UPDATE`,
        [employer.rows[0].id, record.id, payload.category],
      );
      for (const previous of replaceable.rows) {
        await query(
          `UPDATE employer_verification_documents SET "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1 AND "archivedAt" IS NULL`,
          [previous.id],
        );
        await audit(query, actor.userId, 'EMPLOYER_VERIFICATION_DOCUMENT_SUPERSEDED', previous.id, `Superseded by replacement document ${id}.`);
      }
      await query(
        `INSERT INTO employer_verification_documents
         (id, "employerId", "verificationRecordId", category, "originalFilename", "storageKey",
          "contentType", "sizeBytes", status, "submittedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, employer.rows[0].id, record.id, payload.category, originalFilename, storageKey, payload.contentType, bytes.length],
      );
      await audit(query, actor.userId, 'EMPLOYER_VERIFICATION_DOCUMENT_UPLOADED', id, `Category: ${payload.category}; type: ${payload.contentType}; size: ${bytes.length} bytes.`);
      return {
        id,
        employerId: employer.rows[0].id,
        verificationRecordId: record.id,
        category: payload.category,
        originalFilename,
        contentType: payload.contentType,
        sizeBytes: bytes.length,
        status: 'PENDING',
        reviewNotes: null,
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
      };
    });
    return document;
  } catch (error) {
    try {
      await unlink(storagePath);
    } catch (cleanupError) {
      console.error('[verification-documents] Failed to remove an uncommitted upload:', cleanupError instanceof Error ? cleanupError.name : 'UnknownError');
    }
    throw error;
  }
}

export async function listEmployerVerificationDocuments(actor: AuthActor): Promise<StoredVerificationDocument[]> {
  const result = await db.query<StoredVerificationDocument>(
    `SELECT d.id, d."employerId", d."verificationRecordId", d.category, d."originalFilename",
      d."contentType", d."sizeBytes", d.status, d."reviewNotes", d."submittedAt", d."reviewedAt"
     FROM employer_verification_documents d
     JOIN employer_profiles e ON e.id = d."employerId"
     JOIN employer_verification_records v ON v.id = d."verificationRecordId"
     WHERE e."userId" = $1 AND e."archivedAt" IS NULL AND d."archivedAt" IS NULL AND v."archivedAt" IS NULL
       AND v.id = (
         SELECT latest.id FROM employer_verification_records latest
         WHERE latest."employerId" = e.id AND latest."archivedAt" IS NULL
         ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1
       )
     ORDER BY d."submittedAt" DESC, d.id DESC`,
    [actor.userId],
  );
  return result.rows;
}

export async function listAdminEmployerVerificationDocuments(employerId: string): Promise<StoredVerificationDocument[]> {
  const result = await db.query<StoredVerificationDocument>(
    `SELECT d.id, d."employerId", d."verificationRecordId", d.category, d."originalFilename",
      d."contentType", d."sizeBytes", d.status, d."reviewNotes", d."submittedAt", d."reviewedAt",
      reviewer."fullName" AS "reviewerName"
     FROM employer_verification_documents d
     JOIN employer_profiles e ON e.id = d."employerId"
     LEFT JOIN users reviewer ON reviewer.id = d."reviewerAdminId"
     WHERE e.id = $1 AND e."archivedAt" IS NULL AND d."archivedAt" IS NULL
     ORDER BY d."submittedAt" DESC, d.id DESC`,
    [employerId],
  );
  return result.rows;
}

export async function listAdminEmployerVerificationHistory(employerId: string) {
  const result = await db.query(
    `SELECT v.id, v."tinNumber", v."businessLicenseNo", v.status, v."reviewNotes",
      v."createdAt" AS "submittedAt", v."reviewedAt", reviewer."fullName" AS "reviewerName"
     FROM employer_profiles e
     JOIN employer_verification_records v ON v."employerId" = e.id
     LEFT JOIN users reviewer ON reviewer.id = v."reviewerAdminId"
     WHERE e.id = $1 AND e."archivedAt" IS NULL AND v."archivedAt" IS NULL
     ORDER BY v."createdAt" DESC, v.id DESC`,
    [employerId],
  );
  return result.rows;
}

export async function reviewEmployerVerificationDocument(
  documentId: string,
  actor: AuthActor,
  input: EmployerVerificationDocumentReview,
): Promise<'updated' | 'not_found' | 'conflict'> {
  return db.transaction(async ({ query }) => {
    const selected = await query<{ id: string; status: string }>(
      `SELECT id, status FROM employer_verification_documents
       WHERE id = $1 AND "archivedAt" IS NULL FOR UPDATE`,
      [documentId],
    );
    const document = selected.rows[0];
    if (!document) return 'not_found';
    if (document.status === 'APPROVED' || document.status === 'REJECTED') return 'conflict';
    await query(
      `UPDATE employer_verification_documents SET status = $1, "reviewerAdminId" = $2,
       "reviewNotes" = $3, "reviewedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $4 AND "archivedAt" IS NULL`,
      [input.status, actor.userId, input.reviewNotes, documentId],
    );
    await audit(query, actor.userId, `EMPLOYER_VERIFICATION_DOCUMENT_${input.status}`, documentId, input.reviewNotes);
    return 'updated';
  });
}

export async function readAdminVerificationDocument(employerId: string, documentId: string) {
  const result = await db.query<StoredVerificationDocument & { storageKey: string }>(
    `SELECT d.id, d."employerId", d."verificationRecordId", d.category, d."originalFilename",
      d."storageKey", d."contentType", d."sizeBytes", d.status, d."reviewNotes", d."submittedAt", d."reviewedAt"
     FROM employer_verification_documents d
     JOIN employer_verification_records v ON v.id = d."verificationRecordId"
     JOIN employer_profiles e ON e.id = d."employerId"
     WHERE e.id = $1 AND d.id = $2 AND d."archivedAt" IS NULL
       AND v."archivedAt" IS NULL AND e."archivedAt" IS NULL`,
    [employerId, documentId],
  );
  return result.rows[0] ?? null;
}

export async function recordAdminVerificationDocumentAccess(
  actor: AuthActor,
  documentId: string,
  disposition: 'inline' | 'attachment',
  outcome: 'success' | 'missing' | 'unavailable',
): Promise<void> {
  await db.query(
    `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
     VALUES ($1, $2, 'ADMIN_VERIFICATION_DOCUMENT_ACCESS', 'EmployerVerificationDocument', $3, $4)`,
    [`audit-${randomUUID()}`, actor.userId, documentId, JSON.stringify({ disposition, outcome })],
  );
}

export async function getVerifiedDocumentBytes(storageKey: string): Promise<Buffer> {
  try {
    const bytes = await readFile(path.join(verificationDocumentDirectory(), storageKey));
    if (!inspectVerificationDocument(bytes)) throw new VerificationDocumentError('Stored document failed its file-type check.', 415);
    return bytes;
  } catch (error) {
    if (error instanceof VerificationDocumentError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new VerificationDocumentError('The stored document file is missing.', 404);
    throw new VerificationDocumentError('The private document store is unavailable.', 503);
  }
}
