import { z } from 'zod';

export { accountUpdateSchema, loginSchema, registerSchema } from '../modules/auth/auth.schemas';
export { jobApplicationSchema, jobCreationSchema } from '../modules/jobs/jobs.schemas';
export { candidateProfileUpdateSchema, candidateSkillSchema } from '../modules/candidates/candidates.schemas';

export { applicationStatusUpdateSchema, verificationSubmissionSchema } from '../modules/employers/employers.schemas';

export { verificationReviewSchema } from '../modules/admin/admin.schemas';

export { evaluationSubmissionSchema } from '../modules/evaluations/evaluations.schemas';

export { aiSkillAdvisorSchema, jobEnhancerSchema } from '../modules/ai-nexus/ai-nexus.schemas';
