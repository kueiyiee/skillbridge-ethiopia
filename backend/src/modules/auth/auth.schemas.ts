import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Valid email address required').max(191),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().trim().min(2, 'Full name required').max(120),
  role: z.enum(['JOB_SEEKER', 'EMPLOYER']),
  phone: z.string().trim().max(32).optional(),
  companyOrSchool: z.string().trim().max(160).optional(),
});

export const verifyEmailCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.')
});

export const requestEmailVerificationSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(191),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email or username required').max(320),
  password: z.string().min(1, 'Password required'),
});

export const accountUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).optional(),
}).refine((data) => data.fullName !== undefined || data.phone !== undefined, {
  message: 'At least one account field is required.',
});

export const accountDeletionSchema = z.object({ password: z.string().min(1) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(12, 'Use at least 12 characters.').max(72).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be no more than 72 UTF-8 bytes.'
  ),
  confirmPassword: z.string().min(1).max(72),
}).refine((input) => input.newPassword === input.confirmPassword, {
  path: ['confirmPassword'],
  message: 'New passwords do not match.',
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(191),
});

export const passwordResetSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(191),
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit reset code.'),
  newPassword: z.string().min(12, 'Use at least 12 characters.').max(72).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be no more than 72 UTF-8 bytes.'
  ),
  confirmPassword: z.string().min(1).max(72),
}).refine((input) => input.newPassword === input.confirmPassword, {
  path: ['confirmPassword'],
  message: 'New passwords do not match.',
});

export const mfaEnrollmentSchema = z.object({
  currentPassword: z.string().min(1).max(72),
});
export const mfaCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the current six-digit authenticator code.'),
});
export const mfaDisableSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  code: z.string().trim().regex(/^(?:\d{6}|[A-Fa-f0-9]{20})$/, 'Enter a six-digit authenticator code or one unused recovery code.'),
});
export const mfaLoginSchema = z.object({
  challengeId: z.uuid(),
  code: z.string().trim().min(6).max(32).regex(/^(?:\d{6}|[A-Fa-f0-9]{20})$/, 'Enter a six-digit authenticator code or one unused recovery code.'),
});
