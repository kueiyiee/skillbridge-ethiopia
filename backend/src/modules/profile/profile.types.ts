import type { z } from 'zod';
import type { profileUpdateSchema } from './profile.schemas';

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;