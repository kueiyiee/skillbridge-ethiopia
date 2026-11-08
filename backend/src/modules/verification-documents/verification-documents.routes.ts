import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { MysqlRateLimitStore } from '../../middleware/mysql-rate-limit-store';
import { db } from '../../infrastructure/database/drizzle';
import {
  accessEmployerVerificationDocumentController,
  listAdminEmployerVerificationDocumentsController,
  listAdminEmployerVerificationHistoryController,
  listEmployerVerificationDocumentsController,
  reviewEmployerVerificationDocumentController,
  uploadEmployerVerificationDocumentController,
} from './verification-documents.controller';

export const employerVerificationDocumentsRouter = Router();
const employerDocumentUploadStore = new MysqlRateLimitStore(db.query.bind(db), process.env.JWT_SECRET ?? '');
employerDocumentUploadStore.prefix = 'mysql-employer-document-upload:';
const employerDocumentUploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: employerDocumentUploadStore,
  message: { success: false, error: 'Document upload limit reached. Try again later.' },
});
const adminDocumentReviewLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many document review actions. Try again later.' },
});

employerVerificationDocumentsRouter.use(authenticateToken, requireRole('EMPLOYER'));
employerVerificationDocumentsRouter.get('/me/verification/documents', listEmployerVerificationDocumentsController);
employerVerificationDocumentsRouter.post('/me/verification/documents', employerDocumentUploadLimit, uploadEmployerVerificationDocumentController);

export const adminVerificationDocumentsRouter = Router();
adminVerificationDocumentsRouter.use(authenticateToken, requireRole('ADMIN'));
adminVerificationDocumentsRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
adminVerificationDocumentsRouter.get('/verifications/employers/:employerId/documents', listAdminEmployerVerificationDocumentsController);
adminVerificationDocumentsRouter.get('/verifications/employers/:employerId/history', listAdminEmployerVerificationHistoryController);
adminVerificationDocumentsRouter.patch('/verifications/documents/:documentId', adminDocumentReviewLimit, reviewEmployerVerificationDocumentController);
adminVerificationDocumentsRouter.get('/verifications/employers/:employerId/documents/:documentId', accessEmployerVerificationDocumentController);
