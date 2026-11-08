import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { requireVerifiedEmployer, requireVerifiedEmployerWhenApplicable } from '../../middleware/verified-employer';
import { getEvaluationsController, submitEvaluationController } from './evaluations.controller';

const router = Router();

router.get('/', authenticateToken, requireVerifiedEmployerWhenApplicable, getEvaluationsController);
router.post('/', authenticateToken, requireRole('EMPLOYER'), requireVerifiedEmployer, submitEvaluationController);

export default router;
