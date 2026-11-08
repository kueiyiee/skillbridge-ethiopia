import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { getSkillCatalogController, getSystemStatusController } from './system.controller';

const router = Router();

router.get('/status', authenticateToken, requireRole('ADMIN'), getSystemStatusController);
router.get('/skills', getSkillCatalogController);

export default router;
