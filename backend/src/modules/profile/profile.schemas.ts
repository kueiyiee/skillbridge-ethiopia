import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const usernamePattern = /^(?:[a-zA-Z0-9_]{3,32}|[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)$/;

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  middleName: optionalText(80),
  lastName: optionalText(80),
  username: z.string().trim().max(64).refine((value) => value === '' || usernamePattern.test(value), {
    message: 'Use 3-32 letters, numbers, or underscores, or a valid email-style username up to 64 characters.',
  }).optional(),
  phone: optionalText(32),
  dateOfBirth: z.union([z.string().date(), z.literal('')]).optional(),
  gender: z.enum(['', 'MALE', 'FEMALE', 'PREFER_NOT_TO_SAY', 'SELF_DESCRIBED']).optional(),
  genderDescription: optionalText(80),
  country: optionalText(100),
  region: optionalText(100),
  city: optionalText(100),
  headline: optionalText(160),
  bio: optionalText(2000),
  preferredLanguage: z.string().trim().min(2).max(32),
  portfolioUrl: z.union([z.string().url().max(500), z.literal('')]).optional(),
  linkedinUrl: z.union([z.string().url().max(500), z.literal('')]).optional(),
  website: z.union([z.string().url().max(500), z.literal('')]).optional(),
  companyName: z.union([z.string().trim().min(2).max(160), z.literal('')]).optional(),
  industry: z.union([z.string().trim().min(2).max(120), z.literal('')]).optional(),
  employeeRange: optionalText(80),
  profileVisibility: z.enum(['PRIVATE', 'REGISTERED', 'PUBLIC']),
  showPhone: z.boolean(),
  showEmail: z.boolean(),
  showLocation: z.boolean(),
  showGender: z.boolean(),
  candidateSearchable: z.boolean(),
  employerDiscoverable: z.boolean(),
});

export const profileImageSchema = z.object({
  kind: z.enum(['avatar', 'cover']),
  data: z.string().min(1).max(7_000_000),
});