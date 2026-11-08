import { z } from 'zod';

const optionalSearchText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const applicationStatusUpdateSchema = z.object({
  status: z.enum(['APPLIED', 'SCREENING', 'SHORTLISTED', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN']),
  statusNotes: z.string().trim().max(1000).optional(),
});

export const verificationSubmissionSchema = z.object({
  tinNumber: z.string().min(8, 'Valid Ethiopian TIN number required'),
  businessLicenseNo: z.string().min(5, 'Commercial license number required'),
});

export const candidateSearchSchema = z.object({
  q: optionalSearchText(100),
  skill: optionalSearchText(80),
  location: optionalSearchText(100),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  availability: z.enum(['available', 'unavailable']).optional(),
  sort: z.enum(['relevance', 'recent', 'experience']).default('relevance'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

const reportDateSchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

const orderedReportDates = <T extends { startDate?: string; endDate?: string }>(schema: z.ZodType<T>) =>
  schema.refine((filters) => !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate, {
    message: 'Start date must be on or before end date.',
    path: ['endDate'],
  });

export const employerReportQuerySchema = orderedReportDates(reportDateSchema.extend({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}));

export const employerReportTypeSchema = z.enum([
  'job-performance',
  'applications',
  'pipeline',
  'candidate-activity',
]);

export const employerReportExportQuerySchema = orderedReportDates(reportDateSchema.extend({
  format: z.enum(['csv']).default('csv'),
}));
