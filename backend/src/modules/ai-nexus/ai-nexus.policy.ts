import { AiNexusError } from './ai-nexus.errors';

export function assertConversationExists(exists: boolean): void {
  if (!exists) throw new AiNexusError('Conversation not found or unauthorized', 404);
}

export function assertAdvisorProfileExists(exists: boolean): void {
  if (!exists) throw new AiNexusError('Candidate profile not found.', 404);
}

export function assertAdvisorJobExists(exists: boolean): void {
  if (!exists) throw new AiNexusError('Active job not found.', 404);
}
