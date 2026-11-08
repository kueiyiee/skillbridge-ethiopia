import authRouter from './auth/auth.routes';
import jobsRouter from './jobs/jobs.routes';
import employersRouter from './employers/employers.routes';
import candidatesRouter from './candidates/candidates.routes';
import adminRouter from './admin/admin.routes';
import evaluationsRouter from './evaluations/evaluations.routes';
import aiNexusRouter from './ai-nexus/ai-nexus.routes';
import systemRouter from './system/system.routes';
import profileRouter from './profile/profile.routes';
import messagingRouter from './messaging/messaging.routes';
import {
  adminVerificationDocumentsRouter,
  employerVerificationDocumentsRouter,
} from './verification-documents/verification-documents.routes';

export const apiModules = [
  { path: '/api/auth', router: authRouter },
  { path: '/api/jobs', router: jobsRouter },
  { path: '/api/employers', router: employersRouter },
  { path: '/api/employers', router: employerVerificationDocumentsRouter },
  { path: '/api/candidates', router: candidatesRouter },
  { path: '/api/admin', router: adminRouter },
  { path: '/api/admin', router: adminVerificationDocumentsRouter },
  { path: '/api/evaluations', router: evaluationsRouter },
  { path: '/api/ai', router: aiNexusRouter },
  { path: '/api/system', router: systemRouter },
  { path: '/api/profile', router: profileRouter },
  { path: '/api/messages', router: messagingRouter },
] as const;
