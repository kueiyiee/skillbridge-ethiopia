import type { z } from 'zod';
import type { nexusQuerySchema } from './ai-nexus.schemas';

export type AiRole = 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
export type NexusQueryInput = z.infer<typeof nexusQuerySchema>;

export interface AiActor {
  userId: string;
  email: string;
  role: AiRole;
  fullName?: string;
}

export type AiRow = Record<string, any>;
