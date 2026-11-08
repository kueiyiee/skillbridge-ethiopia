import type { z } from 'zod';
import type { evaluationSubmissionSchema } from './evaluations.schemas';

export type EvaluationInput = z.infer<typeof evaluationSubmissionSchema>;
export type EvaluationRole = 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';

export interface EvaluationActor {
  userId: string;
  role: EvaluationRole;
}

export type EvaluationRow = Record<string, unknown>;
