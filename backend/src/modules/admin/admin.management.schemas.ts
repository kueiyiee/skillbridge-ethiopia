import { z } from 'zod';

export const adminManagementEntitySchema = z.enum([
  'users',
  'employers',
  'jobs',
  'verifications',
  'applications',
]);

export const adminManagementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).default(''),
  includeArchived: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});

const userFields = {
  email: z.email().trim().toLowerCase().max(191),
  fullName: z.string().trim().min(2).max(191),
  phone: z.string().trim().max(191).nullable().optional(),
};

const employerFields = {
  companyName: z.string().trim().min(2).max(191),
  industry: z.string().trim().min(2).max(191),
  city: z.string().trim().min(2).max(191),
  address: z.string().trim().max(191).nullable().optional(),
  website: z.url().trim().max(191).nullable().optional(),
  employeeRange: z.string().trim().min(1).max(191),
  companyOverview: z.string().trim().max(10000).nullable().optional(),
};

const jobFields = {
  employerId: z.string().trim().min(1).max(191),
  title: z.string().trim().min(2).max(191),
  summary: z.string().trim().min(10).max(10000),
  responsibilities: z.string().trim().min(3).max(10000),
  qualifications: z.string().trim().min(3).max(10000),
  department: z.string().trim().max(191).nullable().optional(),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID']),
  city: z.string().trim().min(2).max(191),
  workplaceType: z.string().trim().min(2).max(191),
  minExperienceYears: z.number().int().min(0).max(80),
  salaryMinETB: z.number().int().min(0).nullable().optional(),
  salaryMaxETB: z.number().int().min(0).nullable().optional(),
  isSalaryNegotiable: z.boolean(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']),
  deadline: z.iso.datetime().nullable().optional(),
};

const applicationFields = {
  jobId: z.string().trim().min(1).max(191),
  jobSeekerId: z.string().trim().min(1).max(191),
  status: z.enum(['APPLIED', 'SCREENING', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'WITHDRAWN']),
  coverNote: z.string().trim().max(10000).nullable().optional(),
  statusNotes: z.string().trim().max(10000).nullable().optional(),
  matchScore: z.number().int().min(0).max(100),
};

const jobRecordSchema = z.object(jobFields).superRefine((job, context) => {
  if (job.salaryMinETB != null && job.salaryMaxETB != null && job.salaryMaxETB < job.salaryMinETB) {
    context.addIssue({ code: 'custom', path: ['salaryMaxETB'], message: 'Maximum salary must be at least the minimum salary.' });
  }
});

const jobUpdateSchema = z.object(jobFields).partial().superRefine((job, context) => {
  if (job.salaryMinETB != null && job.salaryMaxETB != null && job.salaryMaxETB < job.salaryMinETB) {
    context.addIssue({ code: 'custom', path: ['salaryMaxETB'], message: 'Maximum salary must be at least the minimum salary.' });
  }
});

export const adminManagementCreateSchema = z.discriminatedUnion('entity', [
  z.object({
    entity: z.literal('users'),
    data: z.object({ ...userFields, role: z.enum(['JOB_SEEKER', 'EMPLOYER']), password: z.string().min(12).max(128) }),
  }),
  z.object({
    entity: z.literal('employers'),
    data: z.object({
      ...employerFields,
      email: z.email().trim().toLowerCase().max(191),
      fullName: z.string().trim().min(2).max(191),
      phone: z.string().trim().max(191).nullable().optional(),
      password: z.string().min(12).max(128),
    }),
  }),
  z.object({ entity: z.literal('jobs'), data: jobRecordSchema }),
  z.object({ entity: z.literal('applications'), data: z.object(applicationFields) }),
]);

export const adminManagementUpdateSchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('users'), data: z.object(userFields).partial() }),
  z.object({ entity: z.literal('employers'), data: z.object(employerFields).partial() }),
  z.object({ entity: z.literal('jobs'), data: jobUpdateSchema }),
  z.object({ entity: z.literal('applications'), data: z.object(applicationFields).partial() }),
]);

export type AdminManagementEntity = z.infer<typeof adminManagementEntitySchema>;
export type AdminManagementData = Record<string, unknown>;
