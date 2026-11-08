import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { requireVerifiedEmployer } from '../../middleware/verified-employer';
import {
  getEmployerAnalyticsController,
  getEmployerApplicationsController,
  getEmployerCandidateDetailsController,
  getEmployerDashboardController,
  getEmployerReportsController,
  getEmployerReportPreviewController,
  exportEmployerReportController,
  getPublicEmployersController,
  submitEmployerVerificationController,
  searchEmployerCandidatesController,
  updateEmployerApplicationStatusController,
} from './employers.controller';

const router = Router();
const employerOnly = [authenticateToken, requireRole('EMPLOYER')];
const employerReportPreviewLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many report previews. Please try again later.' },
});
const employerReportExportLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many report exports. Please try again later.' },
});
const noStoreEmployerReport = (_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store');
  next();
};

router.get('/', getPublicEmployersController);
router.get('/me', employerOnly, getEmployerDashboardController);
router.post('/me/verify', employerOnly, submitEmployerVerificationController);
router.get('/me/applications', employerOnly, requireVerifiedEmployer, getEmployerApplicationsController);
router.get('/me/candidates', employerOnly, requireVerifiedEmployer, searchEmployerCandidatesController);
router.get('/me/candidates/:candidateId', employerOnly, requireVerifiedEmployer, getEmployerCandidateDetailsController);
router.get('/me/reports', employerOnly, requireVerifiedEmployer, noStoreEmployerReport, getEmployerReportsController);
router.get('/me/reports/:reportType/preview', employerOnly, requireVerifiedEmployer, employerReportPreviewLimit, noStoreEmployerReport, getEmployerReportPreviewController);
router.get('/me/reports/:reportType/export', employerOnly, requireVerifiedEmployer, employerReportExportLimit, noStoreEmployerReport, exportEmployerReportController);
router.patch('/me/applications/:id/status', employerOnly, requireVerifiedEmployer, updateEmployerApplicationStatusController);
router.get('/me/analytics', employerOnly, requireVerifiedEmployer, getEmployerAnalyticsController);

export default router;
