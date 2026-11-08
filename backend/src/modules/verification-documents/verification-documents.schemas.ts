import { z } from 'zod';

const supportedContentTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const employerVerificationDocumentUploadSchema = z.object({
  category: z.enum(['BUSINESS_REGISTRATION', 'TIN_CERTIFICATE', 'SUPPORTING']),
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.enum(supportedContentTypes),
  data: z.string().min(1).max(5_600_000),
});

export const employerVerificationDocumentReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED']),
  reviewNotes: z.string().trim().min(3).max(1000),
});

export const employerVerificationDocumentAccessSchema = z.object({
  disposition: z.enum(['inline', 'attachment']).default('attachment'),
});

export type EmployerVerificationDocumentCategory = z.infer<typeof employerVerificationDocumentUploadSchema>['category'];
export type EmployerVerificationDocumentReview = z.infer<typeof employerVerificationDocumentReviewSchema>;
