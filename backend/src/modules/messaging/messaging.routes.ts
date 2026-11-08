import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { requireVerifiedEmployer } from '../../middleware/verified-employer';
import {
  answerInterviewInvitationController,
  getApplicationConversationController,
  getMessageThreadsController,
  sendCandidateReplyController,
  sendBulkEmployerMessagesController,
  sendEmployerMessageController,
} from './messaging.controller';

const router = Router();
const employerMessageLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Employer messaging is temporarily rate limited. Please try again later.' },
});
const employerBulkMessageLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Bulk candidate updates are temporarily rate limited. Please try again later.' },
});

router.get('/candidate/threads', authenticateToken, requireRole('JOB_SEEKER'), getMessageThreadsController);
router.get('/candidate/threads/:applicationId', authenticateToken, requireRole('JOB_SEEKER'), getApplicationConversationController);
router.post('/candidate/threads/:applicationId', authenticateToken, requireRole('JOB_SEEKER'), sendCandidateReplyController);
router.post('/candidate/threads/:applicationId/respond/:messageId', authenticateToken, requireRole('JOB_SEEKER'), answerInterviewInvitationController);

router.use('/employer', authenticateToken, requireRole('EMPLOYER'), requireVerifiedEmployer);
router.get('/employer/threads', getMessageThreadsController);
router.get('/employer/threads/:applicationId', getApplicationConversationController);
router.post('/employer/threads/:applicationId', employerMessageLimit, sendEmployerMessageController);
router.post('/employer/bulk', employerBulkMessageLimit, sendBulkEmployerMessagesController);

export default router;
