import { EmployerError } from './employers.errors';
import type { ApplicationStatus } from '../../../../shared/types';

const allowedApplicationTransitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  APPLIED: ['SCREENING', 'SHORTLISTED', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'REJECTED'],
  SCREENING: ['SHORTLISTED', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'REJECTED'],
  SHORTLISTED: ['TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'],
  TECHNICAL_ASSESSMENT: ['INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['OFFERED', 'REJECTED'],
  OFFERED: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function assertEmployerExists(exists: boolean, message = 'Employer profile not found'): void {
  if (!exists) throw new EmployerError(message, 404);
}

export function assertApplicationManaged(isManaged: boolean): void {
  if (!isManaged) {
    throw new EmployerError('Unauthorized. You do not manage the job listing for this application.', 403);
  }
}

export function assertEmployerIsVerified(isVerified: boolean): void {
  if (!isVerified) {
    throw new EmployerError('Complete employer business verification before using recruiting features.', 403);
  }
}

export function assertNoPendingVerification(hasPending: boolean): void {
  if (hasPending) throw new EmployerError('A verification submission is already pending review.', 409);
}

export function assertApplicationStatusTransition(current: ApplicationStatus, next: ApplicationStatus): void {
  if (!allowedApplicationTransitions[current].includes(next)) {
    throw new EmployerError(`Application cannot move from ${current} to ${next}.`, 409);
  }
}
