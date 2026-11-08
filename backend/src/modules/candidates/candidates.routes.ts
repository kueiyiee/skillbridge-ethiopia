import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../../middleware/auth';
import {
  addMySkillController,
  getMySkillsController,
  getMyApplicationsController,
  getMyLearningPathController,
  getMyProfileController,
  getMyRecommendationsController,
  getMySavedJobsController,
  getMySkillAssessmentsController,
  getMySkillAssessmentQuestionsController,
  removeMySkillController,
  submitMySkillAssessmentController,
  updateMySkillController,
  updateMyProfileController,
} from './candidates.controller';

const router = Router();
const skillAssessmentSubmissionLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Skill assessment attempts are temporarily rate limited. Please try again later.' },
});
router.use(authenticateToken, requireRole('JOB_SEEKER'));

router.get('/me', getMyProfileController);
router.patch('/me', updateMyProfileController);
router.get('/me/skills', getMySkillsController);
router.post('/me/skills', addMySkillController);
router.get('/me/skills/assessments', getMySkillAssessmentsController);
router.get('/me/skills/:id/assessment', getMySkillAssessmentQuestionsController);
router.post('/me/skills/:id/assessments', skillAssessmentSubmissionLimit, submitMySkillAssessmentController);
router.patch('/me/skills/:id', updateMySkillController);
router.delete('/me/skills/:id', removeMySkillController);
router.get('/me/applications', getMyApplicationsController);
router.get('/me/saved-jobs', getMySavedJobsController);
router.get('/me/recommendations', getMyRecommendationsController);
router.get('/me/learning-path', getMyLearningPathController);

export default router;
