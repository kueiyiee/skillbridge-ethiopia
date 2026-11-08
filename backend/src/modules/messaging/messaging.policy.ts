import { MessagingError } from './messaging.errors';

export type MessagingRole = 'JOB_SEEKER' | 'EMPLOYER';

export function assertApplicationParticipant(
  thread: { candidateUserId: string; employerUserId: string; employerVerified: boolean },
  userId: string,
  role: MessagingRole,
): void {
  const isParticipant = role === 'JOB_SEEKER'
    ? thread.candidateUserId === userId
    : thread.employerUserId === userId;
  if (!isParticipant) throw new MessagingError('You do not have access to this application conversation.', 403);
  if (role === 'EMPLOYER' && !thread.employerVerified) {
    throw new MessagingError('Complete employer business verification before using messaging.', 403);
  }
}

export function assertInvitationCanBeAnswered(
  message: { recipientUserId: string; kind: string; actionStatus: string } | undefined,
  userId: string,
): asserts message is { recipientUserId: string; kind: string; actionStatus: string } {
  if (!message || message.recipientUserId !== userId || message.kind !== 'INTERVIEW_INVITATION') {
    throw new MessagingError('This interview invitation is not available to respond to.', 404);
  }
  if (message.actionStatus !== 'PENDING') {
    throw new MessagingError('This interview invitation has already been answered.', 409);
  }
}
