import { EvaluationError } from './evaluations.errors';

export function assertEmployerProfileExists(exists: boolean): void {
  if (!exists) throw new EvaluationError('Employer profile not found', 403);
}

export function assertEmployerIsVerified(isVerified: boolean): void {
  if (!isVerified) throw new EvaluationError('Complete employer business verification before using recruiting features.', 403);
}

export function assertCandidateProfileExists(exists: boolean): void {
  if (!exists) throw new EvaluationError('Target candidate profile not found', 400);
}

export function assertJobOwnership(isOwner: boolean): void {
  if (!isOwner) throw new EvaluationError('Unauthorized. You do not own this job listing.', 403);
}
