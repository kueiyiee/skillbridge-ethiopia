import { Router } from 'express';
import { authenticateToken, optionalAuth, requireRole } from '../../middleware/auth';
import { requireVerifiedEmployer } from '../../middleware/verified-employer';
import {
  analyzeJobGapController,
  applyForJobController,
  createJobController,
  getJobController,
  listJobsController,
  removeSavedJobController,
  saveJobController,
  updateJobController,
  updateJobStatusController,
} from './jobs.controller';

const router = Router();

router.get('/', optionalAuth, listJobsController);
router.get('/:id', optionalAuth, getJobController);
router.post('/', authenticateToken, requireRole('EMPLOYER'), requireVerifiedEmployer, createJobController);
router.patch('/:id', authenticateToken, requireRole('EMPLOYER'), requireVerifiedEmployer, updateJobController);
router.patch('/:id/status', authenticateToken, requireRole('EMPLOYER'), requireVerifiedEmployer, updateJobStatusController);
router.post('/:id/apply', authenticateToken, requireRole('JOB_SEEKER'), applyForJobController);
router.post('/:id/save', authenticateToken, requireRole('JOB_SEEKER'), saveJobController);
router.delete('/:id/save', authenticateToken, requireRole('JOB_SEEKER'), removeSavedJobController);
router.post('/:id/analyze-gap', authenticateToken, requireRole('JOB_SEEKER'), analyzeJobGapController);

export default router;
