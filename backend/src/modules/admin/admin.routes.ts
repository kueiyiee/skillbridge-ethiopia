import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../../middleware/auth';
import {
  getAdminMetricsController,
  getAdminDiagnosticsController,
  getAdminReportController,
  listAuditLogsController,
  listAdminJobsController,
  listUsersController,
  listVerificationsController,
  getEmployerVerificationSummaryController,
  moderateUserController,
  moderateAdminJobController,
  exportAdminReportController,
  reviewVerificationController,
} from './admin.controller';
import {
  archiveManagedRecordController,
  createManagedRecordController,
  getManagementOptionsController,
  listManagedRecordsController,
  restoreManagedRecordController,
  updateManagedRecordController,
} from './admin.management.controller';
import {
  getUserEmailVerificationDetailsController,
  manuallyVerifyEmployerEmailController,
  manuallyVerifyUserEmailController,
  resendEmployerVerificationEmailController,
  resendUserVerificationEmailController,
} from './admin.email-verification.controller';

const router = Router();
const governanceMutationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many governance changes. Please try again later.' },
});
const reportExportLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many report exports. Please try again later.' },
});
const reportPreviewLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many report previews. Please try again later.' },
});

router.use(authenticateToken, requireRole('ADMIN'));
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/manage-options', getManagementOptionsController);
router.get('/manage/:entity', listManagedRecordsController);
router.post('/manage/:entity', governanceMutationLimit, createManagedRecordController);
router.put('/manage/:entity/:id', governanceMutationLimit, updateManagedRecordController);
router.delete('/manage/:entity/:id', governanceMutationLimit, archiveManagedRecordController);
router.post('/manage/:entity/:id/restore', governanceMutationLimit, restoreManagedRecordController);
router.get('/verifications', listVerificationsController);
router.get('/verifications/summary', getEmployerVerificationSummaryController);
router.patch('/verifications/:id', governanceMutationLimit, reviewVerificationController);
router.get('/users', listUsersController);
router.patch('/users/:id/moderate', governanceMutationLimit, moderateUserController);
router.get('/users/:id/email-verification', getUserEmailVerificationDetailsController);
router.patch('/users/:id/email-verification/verify', governanceMutationLimit, manuallyVerifyUserEmailController);
router.post('/users/:id/email-verification/resend', governanceMutationLimit, resendUserVerificationEmailController);
router.patch('/verifications/:id/email/verify', governanceMutationLimit, manuallyVerifyEmployerEmailController);
router.post('/verifications/:id/email/resend', governanceMutationLimit, resendEmployerVerificationEmailController);
router.get('/jobs', listAdminJobsController);
router.patch('/jobs/:id/moderate', governanceMutationLimit, moderateAdminJobController);
router.get('/audit-logs', listAuditLogsController);
router.get('/reports', reportPreviewLimit, getAdminReportController);
router.post('/reports/export', reportExportLimit, exportAdminReportController);
router.get('/metrics', getAdminMetricsController);
router.get('/diagnostics', getAdminDiagnosticsController);

export default router;
