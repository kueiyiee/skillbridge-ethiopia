import type { z } from 'zod';
import type { accountDeletionSchema, accountUpdateSchema, changePasswordSchema, loginSchema, registerSchema, verifyEmailCodeSchema } from './auth.schemas';

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailCodeInput = z.infer<typeof verifyEmailCodeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountDeletionInput = z.infer<typeof accountDeletionSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AuthRole = 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';

export interface AuthActor {
  userId: string;
  email: string;
  role: AuthRole;
  fullName?: string;
  emailVerified?: boolean;
  authVersion?: number;
  sessionId?: string;
  sessionExpiresAt?: number;
}

export interface AuthDatabaseUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: AuthRole;
  isActive: boolean;
  emailVerified: boolean;
  authVersion?: number;
}

export type AuthIdentityRow = Pick<AuthDatabaseUser, 'id' | 'email' | 'role' | 'fullName' | 'isActive' | 'emailVerified' | 'authVersion'>;

export type AuthProfile = Record<string, unknown>;
