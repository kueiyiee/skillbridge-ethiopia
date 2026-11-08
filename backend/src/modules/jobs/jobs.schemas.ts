import { z } from 'zod';

export const jobSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  type: z.string().trim().max(40).optional(),
  skill: z.string().trim().max(120).optional(),
  minSalary: z.coerce.number().int().min(0).optional(),
});

export const jobCreationSchema = z.object({
  title: z.string().min(3, 'Job title must be at least 3 characters'),
  department: z.string().optional(),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID']).default('FULL_TIME'),
  city: z.string().default('Addis Ababa'),
  workplaceType: z.enum(['Hybrid', 'On-site', 'Remote']).default('Hybrid'),
  summary: z.string().min(10, 'Summary must be at least 10 characters'),
  responsibilities: z.union([z.array(z.string()), z.string()]),
  qualifications: z.union([z.array(z.string()), z.string()]),
  minExperienceYears: z.number().int().min(0).default(0),
  salaryMinETB: z.number().int().min(0).optional(),
  salaryMaxETB: z.number().int().min(0).optional(),
  isSalaryNegotiable: z.boolean().default(true),
  deadline: z.iso.datetime({ offset: true }).optional(),
  skillRequirements: z.array(z.object({
    skillId: z.string().trim().min(1).max(191),
    isMandatory: z.boolean().default(true),
    weight: z.number().int().min(1).max(5).default(3),
    requiredLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('INTERMEDIATE'),
  })).min(1, 'At least one skill requirement is required'),
}).superRefine((input, context) => {
  if (input.salaryMinETB !== undefined && input.salaryMaxETB !== undefined && input.salaryMinETB > input.salaryMaxETB) {
    context.addIssue({ code: 'custom', path: ['salaryMaxETB'], message: 'Maximum salary must be greater than or equal to minimum salary.' });
  }
});

export const jobApplicationSchema = z.object({
  coverNote: z.string().max(1500).optional(),
  resumeSnapshotUrl: z.string().optional(),
});

export const jobStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED', 'PAUSED']),
});

export const jobMatchWeightsSchema = z.object({
  skillWeight: z.number().finite().min(0).max(1).optional(),
  experienceWeight: z.number().finite().min(0).max(1).optional(),
});
