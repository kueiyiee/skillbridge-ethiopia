import { z } from 'zod';

export const evaluationSubmissionSchema = z.object({
  jobSeekerId: z.string().min(1),
  jobId: z.string().min(1),
  period: z.string().min(2),
  technicalScore: z.number().min(1).max(5),
  deliveryScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  adaptabilityScore: z.number().min(1).max(5),
  strengths: z.string().min(5),
  growthAreas: z.string().min(5),
  retentionRecommendation: z.enum(['HIGHLY_RECOMMENDED', 'CONFIRMED', 'EXTEND_PROBATION', 'TERMINATE']),
});
