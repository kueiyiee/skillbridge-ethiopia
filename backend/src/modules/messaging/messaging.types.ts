import type { z } from 'zod';
import type { candidateReplySchema, employerBulkMessageSchema, employerMessageSchema } from './messaging.schemas';

export type CandidateReplyInput = z.infer<typeof candidateReplySchema>;
export type EmployerMessageInput = z.infer<typeof employerMessageSchema>;
export type EmployerBulkMessageInput = z.infer<typeof employerBulkMessageSchema>;
