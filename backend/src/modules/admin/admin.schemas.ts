import { z } from 'zod';

export const verificationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED']),
  reviewNotes: z.string().trim().min(3, 'Review notes explaining determination required').max(1000),
});

export const adminRecordIdSchema = z.string().trim().min(1).max(191);

export const userModerationSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const adminUsersQuerySchema = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).default(''),
  role: z.enum(['JOB_SEEKER', 'EMPLOYER', 'ADMIN']).optional(),
  status: z.enum(['active', 'suspended', 'pending_verification']).optional(),
  emailStatus: z.enum(['verified', 'unverified', 'action_required']).optional(),
});

export const adminVerificationsQuerySchema = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).default(''),
  status: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED']).optional(),
  emailStatus: z.enum(['verified', 'unverified', 'action_required']).optional(),
  sort: z.enum(['createdAt', 'companyName', 'email', 'status']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const adminJobsQuerySchema = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).default(''),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED']).optional(),
});

export const adminJobModerationSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']),
  reason: z.string().trim().min(3).max(500),
});

export const adminReportTypeSchema = z.enum([
  'platform-overview',
  'employer-verification',
  'user-management',
  'jobs-moderation',
  'applications',
  'audit-activity',
  'system-health',
  'ai-integration-usage',
]);

const adminReportStatusSchema = z.enum([
  'PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED',
  'active', 'suspended',
  'DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED',
  'APPLIED', 'SCREENING', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'WITHDRAWN',
]);

export const adminReportQuerySchema = z.object({
  type: adminReportTypeSchema,
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  status: adminReportStatusSchema.optional(),
  role: z.enum(['JOB_SEEKER', 'EMPLOYER', 'ADMIN']).optional(),
  category: z.string().trim().max(100).optional(),
  actor: z.string().trim().max(100).optional(),
  eventType: z.string().trim().max(100).optional(),
  outcome: z.enum(['approved', 'rejected', 'recorded']).optional(),
  columns: z.string().trim().min(1).max(1000).transform((value) => value.split(',').map((column) => column.trim()).filter(Boolean)).optional(),
}).superRefine((input, context) => {
  if (input.startDate && input.endDate && input.startDate > input.endDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date.' });
  }
  if (input.role && input.type !== 'user-management') {
    context.addIssue({ code: 'custom', path: ['role'], message: 'Role filter is only supported for user-management reports.' });
  }
  if (input.status && !['employer-verification', 'user-management', 'jobs-moderation', 'applications'].includes(input.type)) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Status filter is not supported for this report type.' });
  }
  const statusesByReport: Partial<Record<z.infer<typeof adminReportTypeSchema>, readonly string[]>> = {
    'employer-verification': ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'],
    'user-management': ['active', 'suspended'],
    'jobs-moderation': ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'],
    applications: ['APPLIED', 'SCREENING', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  };
  if (input.status && !statusesByReport[input.type]?.includes(input.status)) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Status is not valid for the selected report type.' });
  }
  if (input.category && !['employer-verification', 'jobs-moderation', 'applications'].includes(input.type)) {
    context.addIssue({ code: 'custom', path: ['category'], message: 'Category filter is not supported for this report type.' });
  }
  if ((input.actor || input.eventType || input.outcome) && input.type !== 'audit-activity') {
    context.addIssue({ code: 'custom', path: ['eventType'], message: 'Actor, event, and outcome filters are only supported for audit-activity reports.' });
  }
  if (input.columns && (input.columns.length === 0 || new Set(input.columns).size !== input.columns.length)) {
    context.addIssue({ code: 'custom', path: ['columns'], message: 'Select one or more unique report fields.' });
  }
  if ((input.startDate || input.endDate) && ['system-health', 'ai-integration-usage'].includes(input.type)) {
    context.addIssue({ code: 'custom', path: ['startDate'], message: 'System health and AI usage reports are point-in-time snapshots and do not support historical date filters.' });
  }
});

export const adminReportExportSchema = z.object({
  snapshotId: z.uuid(),
  format: z.enum(['pdf', 'xlsx', 'csv']),
});

export const adminAuditQuerySchema = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).default(''),
  action: z.string().trim().min(1).max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
}).refine((input) => !input.from || !input.to || input.from <= input.to, {
  path: ['to'],
  message: 'End timestamp must be on or after start timestamp.',
});
