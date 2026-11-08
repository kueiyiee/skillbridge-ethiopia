import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { requireVerifiedEmployer } from '../../middleware/verified-employer';
import {
  cvAnalysisController,
  deleteConversationController,
  getConversationController,
  jobEnhancerController,
  listConversationsController,
  queryNexusController,
  skillGapAdvisorController,
  streamQueryNexusController,
} from './ai-nexus.controller';

const router = Router();
const generationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'AI usage limit reached. Please try again later.' },
});

router.get('/nexus/conversations', authenticateToken, listConversationsController);
router.get('/nexus/conversations/:id', authenticateToken, getConversationController);
router.post('/nexus/query/stream', authenticateToken, generationLimit, streamQueryNexusController);
router.post('/nexus/query', authenticateToken, generationLimit, queryNexusController);
router.delete('/nexus/conversations/:id', authenticateToken, deleteConversationController);
router.post('/skill-gap-advisor', authenticateToken, requireRole('JOB_SEEKER'), generationLimit, skillGapAdvisorController);
router.post('/cv-analysis', authenticateToken, requireRole('JOB_SEEKER'), generationLimit, cvAnalysisController);
router.post('/job-enhancer', authenticateToken, requireRole('EMPLOYER'), requireVerifiedEmployer, generationLimit, jobEnhancerController);

export default router;
