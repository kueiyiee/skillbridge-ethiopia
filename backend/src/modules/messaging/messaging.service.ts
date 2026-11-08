import { MessagingError } from './messaging.errors';
import {
  assertApplicationParticipant,
  assertInvitationCanBeAnswered,
  type MessagingRole,
} from './messaging.policy';
import {
  findApplicationThread,
  findInterviewInvitation,
  listApplicationMessages,
  listApplicationThreads,
  markIncomingMessagesRead,
  respondToInterviewInvitation,
  sendBulkApplicationMessages,
  sendApplicationMessage,
} from './messaging.repository';
import type { CandidateReplyInput, EmployerBulkMessageInput, EmployerMessageInput } from './messaging.types';

export async function getMessageThreads(userId: string, role: MessagingRole) {
  const threads = await listApplicationThreads(userId, role);
  return {
    unreadCount: threads.reduce((count, thread) => count + Number(thread.unreadCount || 0), 0),
    threads,
  };
}

export async function getApplicationConversation(applicationId: string, userId: string, role: MessagingRole) {
  const thread = await findApplicationThread(applicationId);
  if (!thread) throw new MessagingError('Application conversation not found.', 404);
  assertApplicationParticipant(thread, userId, role);
  await markIncomingMessagesRead(applicationId, userId);
  return {
    thread,
    messages: await listApplicationMessages(applicationId),
  };
}

export async function sendCandidateReply(
  applicationId: string,
  userId: string,
  input: CandidateReplyInput,
) {
  await sendApplicationMessage({
    applicationId,
    userId,
    role: 'JOB_SEEKER',
    kind: 'MESSAGE',
    body: input.body,
  });
}

export async function sendEmployerMessage(
  applicationId: string,
  userId: string,
  input: EmployerMessageInput,
) {
  await sendApplicationMessage({
    applicationId,
    userId,
    role: 'EMPLOYER',
    ...input,
  });
}

export async function sendBulkEmployerMessages(userId: string, input: EmployerBulkMessageInput) {
  return sendBulkApplicationMessages({ ...input, userId });
}

export async function answerInterviewInvitation(
  applicationId: string,
  messageId: string,
  userId: string,
  response: 'ACCEPTED' | 'DECLINED',
) {
  const thread = await findApplicationThread(applicationId);
  if (!thread) throw new MessagingError('Application conversation not found.', 404);
  assertApplicationParticipant(thread, userId, 'JOB_SEEKER');
  const invitation = await findInterviewInvitation(applicationId, messageId);
  assertInvitationCanBeAnswered(invitation, userId);
  const updated = await respondToInterviewInvitation({
    applicationId,
    invitationId: messageId,
    candidateUserId: userId,
    employerUserId: thread.employerUserId,
    response,
  });
  if (!updated) throw new MessagingError('This interview invitation has already been answered.', 409);
}
