import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verifyIssuedReportController } from './report-verification.controller';

const router = Router();
const verifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many report verification requests. Please try again later.' },
});
router.get('/:reportId', verifyLimit, verifyIssuedReportController);
export default router;
