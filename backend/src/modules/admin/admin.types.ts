import type { z } from 'zod';
import type { adminAuditQuerySchema, adminJobModerationSchema, adminJobsQuerySchema, adminReportExportSchema, adminReportQuerySchema, adminUsersQuerySchema, adminVerificationsQuerySchema, userModerationSchema, verificationReviewSchema } from './admin.schemas';

export type VerificationReviewInput = z.infer<typeof verificationReviewSchema>;
export type UserModerationInput = z.infer<typeof userModerationSchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminVerificationsQuery = z.infer<typeof adminVerificationsQuerySchema>;
export type AdminJobsQuery = z.infer<typeof adminJobsQuerySchema>;
export type AdminJobModerationInput = z.infer<typeof adminJobModerationSchema>;
export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;
export type AdminReportExportInput = z.infer<typeof adminReportExportSchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export interface AdminActor {
  userId: string;
  fullName?: string;
}
