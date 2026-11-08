import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  employerVerificationDocumentAccessSchema,
  employerVerificationDocumentReviewSchema,
  employerVerificationDocumentUploadSchema,
} from './verification-documents.schemas';
import {
  getVerifiedDocumentBytes,
  listAdminEmployerVerificationHistory,
  listAdminEmployerVerificationDocuments,
  listEmployerVerificationDocuments,
  readAdminVerificationDocument,
  recordAdminVerificationDocumentAccess,
  reviewEmployerVerificationDocument,
  safeDocumentFilename,
  uploadEmployerVerificationDocument,
  VerificationDocumentError,
} from './verification-documents.service';

function sendError(res: Response, error: unknown) {
  if (error instanceof VerificationDocumentError) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error('[verification-documents] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Verification document request failed.' });
}

const recordIdSchema = z.string().trim().min(1).max(191);

export async function uploadEmployerVerificationDocumentController(req: Request, res: Response) {
  const parsed = employerVerificationDocumentUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Choose a supported verification document under 4 MB.' });
  try {
    const document = await uploadEmployerVerificationDocument(req.user!, parsed.data);
    return res.status(201).set('Cache-Control', 'no-store').json({ success: true, data: document });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listEmployerVerificationDocumentsController(req: Request, res: Response) {
  try {
    const documents = await listEmployerVerificationDocuments(req.user!);
    return res.set('Cache-Control', 'no-store').json({ success: true, data: documents });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listAdminEmployerVerificationDocumentsController(req: Request, res: Response) {
  const employerId = recordIdSchema.safeParse(req.params.employerId);
  if (!employerId.success) return res.status(400).json({ success: false, error: 'Invalid employer identifier.' });
  try {
    const documents = await listAdminEmployerVerificationDocuments(employerId.data);
    return res.set('Cache-Control', 'no-store').json({ success: true, data: documents });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listAdminEmployerVerificationHistoryController(req: Request, res: Response) {
  const employerId = recordIdSchema.safeParse(req.params.employerId);
  if (!employerId.success) return res.status(400).json({ success: false, error: 'Invalid employer identifier.' });
  try {
    const history = await listAdminEmployerVerificationHistory(employerId.data);
    return res.set('Cache-Control', 'no-store').json({ success: true, data: history });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function reviewEmployerVerificationDocumentController(req: Request, res: Response) {
  const documentId = recordIdSchema.safeParse(req.params.documentId);
  const parsed = employerVerificationDocumentReviewSchema.safeParse(req.body);
  if (!documentId.success) return res.status(400).json({ success: false, error: 'Invalid document identifier.' });
  if (!parsed.success) return res.status(400).json({ success: false, error: 'A valid document outcome and review note are required.' });
  try {
    const result = await reviewEmployerVerificationDocument(documentId.data, req.user!, parsed.data);
    if (result === 'not_found') return res.status(404).json({ success: false, error: 'Verification document not found.' });
    if (result === 'conflict') return res.status(409).json({ success: false, error: 'This document has already received a final decision.' });
    return res.json({ success: true, message: `Document review recorded: ${parsed.data.status}.` });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function accessEmployerVerificationDocumentController(req: Request, res: Response) {
  const employerId = recordIdSchema.safeParse(req.params.employerId);
  const documentId = recordIdSchema.safeParse(req.params.documentId);
  const query = employerVerificationDocumentAccessSchema.safeParse(req.query);
  if (!employerId.success || !documentId.success || !query.success) {
    return res.status(400).json({ success: false, error: 'Invalid employer document request.' });
  }

  try {
    const document = await readAdminVerificationDocument(employerId.data, documentId.data);
    if (!document) {
      await recordAdminVerificationDocumentAccess(req.user!, documentId.data, query.data.disposition, 'missing');
      return res.status(404).json({ success: false, error: 'Verification document not found.' });
    }
    const bytes = await getVerifiedDocumentBytes(document.storageKey);
    await recordAdminVerificationDocumentAccess(req.user!, document.id, query.data.disposition, 'success');
    const filename = safeDocumentFilename(document.originalFilename);
    const asciiFilename = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return res.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `${query.data.disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(bytes.length),
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Type': document.contentType,
      'X-Content-Type-Options': 'nosniff',
    }).send(bytes);
  } catch (error) {
    if (error instanceof VerificationDocumentError) {
      await recordAdminVerificationDocumentAccess(
        req.user!,
        documentId.data,
        query.data.disposition,
        error.statusCode === 404 ? 'missing' : 'unavailable',
      );
    }
    return sendError(res, error);
  }
}
