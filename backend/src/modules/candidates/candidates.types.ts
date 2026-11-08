import type { z } from 'zod';
import type { candidateProfileUpdateSchema, candidateSkillSchema, candidateSkillUpdateSchema, skillAssessmentSubmissionSchema } from './candidates.schemas';

export type CandidateProfileInput = z.infer<typeof candidateProfileUpdateSchema>;
export type CandidateSkillInput = z.infer<typeof candidateSkillSchema>;
export type CandidateSkillUpdateInput = z.infer<typeof candidateSkillUpdateSchema>;
export type SkillAssessmentSubmissionInput = z.infer<typeof skillAssessmentSubmissionSchema>;
export type CandidateRow = Record<string, unknown>;

export interface CandidateActor {
  userId: string;
}
