import { JobsError } from './jobs.errors';

export function assertJobOwnedByEmployer(isOwner: boolean): void {
  if (!isOwner) {
    throw new JobsError('Unauthorized. You do not own this vacancy.', 403);
  }
}

export function assertEmployerCanPublishJob(isVerified: boolean): void {
  if (!isVerified) {
    throw new JobsError('Organization verification is required before publishing a vacancy.', 403);
  }
}

export function assertEmployerIsVerified(isVerified: boolean): void {
  if (!isVerified) {
    throw new JobsError('Complete employer business verification before using recruiting features.', 403);
  }
}

export function assertJobCanBePublished(isExpired: boolean): void {
  if (isExpired) {
    throw new JobsError('This vacancy has expired and cannot be republished. Create a new posting with a current deadline.', 409);
  }
}

export function assertJobIsActive(isActive: boolean): void {
  if (!isActive) {
    throw new JobsError('Active job not found.', 404);
  }
}

export function assertCandidateProfileExists(exists: boolean, statusCode: 400 | 404, message: string): void {
  if (!exists) {
    throw new JobsError(message, statusCode);
  }
}

export function assertApplicationIsNew(alreadyApplied: boolean): void {
  if (alreadyApplied) {
    throw new JobsError('You have already applied for this job vacancy.', 409);
  }
}
