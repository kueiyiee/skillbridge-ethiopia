import type { z } from 'zod';
import type {
  applicationStatusUpdateSchema,
  candidateSearchSchema,
  employerReportQuerySchema,
  employerReportTypeSchema,
  verificationSubmissionSchema,
} from './employers.schemas';

export type VerificationSubmissionInput = z.infer<typeof verificationSubmissionSchema>;
export type ApplicationStatusInput = z.infer<typeof applicationStatusUpdateSchema>;
export type CandidateSearchInput = z.infer<typeof candidateSearchSchema>;
export type EmployerReportType = z.infer<typeof employerReportTypeSchema>;
export type EmployerReportQuery = z.infer<typeof employerReportQuerySchema>;
export type EmployerRow = Record<string, any>;

export interface CandidateDiscoveryCandidate {
  profileId: string;
  fullName: string;
  headline: string | null;
  desiredRole: string | null;
  experienceYears: number;
  city: string | null;
  availableForWork: boolean;
  skills: Array<{ name: string; proficiencyLevel: string; yearsExperience: number; isVerified: boolean }>;
  applicationId: string | null;
}

export interface EmployerActor {
  userId: string;
}
