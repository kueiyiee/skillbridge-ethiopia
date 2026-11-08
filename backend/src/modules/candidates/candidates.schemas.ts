import { z } from 'zod';

export const candidateProfileUpdateSchema = z.object({
  headline: z.string().max(150).optional(),
  bio: z.string().max(2000).optional(),
  experienceYears: z.number().int().min(0).optional(),
  educationLevel: z.string().optional(),
  institutionName: z.string().optional(),
  city: z.string().optional(),
  subCity: z.string().optional(),
  desiredRole: z.string().optional(),
  desiredSalaryETB: z.number().int().min(0).optional(),
  availableForWork: z.boolean().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'At least one profile field is required.',
});

export const candidateSkillSchema = z.object({
  skillName: z.string().trim().min(1, 'Skill name required').max(120),
  category: z.string().trim().min(1).max(80).default('General'),
  proficiencyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('INTERMEDIATE'),
  yearsExperience: z.number().min(0).max(80).default(0),
});

export const candidateSkillUpdateSchema = z.object({
  proficiencyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  yearsExperience: z.number().min(0).max(80).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'At least one skill field is required.',
});

export const skillAssessmentSubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1).max(191),
    selectedOption: z.number().int().min(0).max(5),
  })).min(1).max(20)
    .refine((answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length, {
      message: 'Each question can only be answered once.',
    }),
});
