import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken } from '../../middleware/auth';
import {
  getMyProfileController,
  getProfileMediaController,
  removeMyProfileImageController,
  updateMyProfileController,
  uploadMyProfileImageController,
} from './profile.controller';

const router = Router();
const uploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

router.get('/media/:filename', authenticateToken, getProfileMediaController);
router.use(authenticateToken);
router.get('/me', getMyProfileController);
router.patch('/me', updateMyProfileController);
router.post('/me/image', uploadLimit, uploadMyProfileImageController);
router.delete('/me/image/:kind', removeMyProfileImageController);

export default router;