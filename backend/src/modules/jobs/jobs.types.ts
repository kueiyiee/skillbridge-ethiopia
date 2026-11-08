import type { z } from 'zod';
import type {
  jobApplicationSchema,
  jobCreationSchema,
  jobMatchWeightsSchema,
  jobSearchSchema,
  jobStatusSchema,
} from './jobs.schemas';

export type JobCreationInput = z.infer<typeof jobCreationSchema>;
export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;
export type JobSearchFilters = z.infer<typeof jobSearchSchema>;
export type JobMatchWeights = z.infer<typeof jobMatchWeightsSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>['status'];

export interface JobActor {
  userId: string;
  role: 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
}

export type JobRow = Record<string, unknown>;
export type JobRequirementRow = Record<string, unknown>;
export type JobView = JobRow & {
  responsibilities: string[];
  qualifications: string[];
  skillRequirements: JobRequirementRow[];
  applicantsCount: number;
};
