import type { Request, Response } from 'express';
import { MessagingError } from './messaging.errors';
import {
  candidateReplySchema,
  employerBulkMessageSchema,
  employerMessageSchema,
  invitationResponseSchema,
} from './messaging.schemas';
import {
  answerInterviewInvitation,
  getApplicationConversation,
  getMessageThreads,
  sendCandidateReply,
  sendBulkEmployerMessages,
  sendEmployerMessage,
} from './messaging.service';

function handleError(res: Response, error: unknown) {
  if (error instanceof MessagingError) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error('[messaging] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function actor(req: Request) {
  const role = req.user!.role;
  if (role !== 'JOB_SEEKER' && role !== 'EMPLOYER') {
    throw new MessagingError('This account cannot use application messaging.', 403);
  }
  return { userId: req.user!.userId, role };
}

export async function getMessageThreadsController(req: Request, res: Response) {
  try {
    const currentActor = actor(req);
    return res.json({ success: true, data: await getMessageThreads(currentActor.userId, currentActor.role) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getApplicationConversationController(req: Request, res: Response) {
  try {
    const currentActor = actor(req);
    const data = await getApplicationConversation(req.params.applicationId, currentActor.userId, currentActor.role);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function sendCandidateReplyController(req: Request, res: Response) {
  try {
    const parsed = candidateReplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    await sendCandidateReply(req.params.applicationId, req.user!.userId, parsed.data);
    return res.status(201).json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function sendEmployerMessageController(req: Request, res: Response) {
  try {
    const parsed = employerMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    await sendEmployerMessage(req.params.applicationId, req.user!.userId, parsed.data);
    return res.status(201).json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function sendBulkEmployerMessagesController(req: Request, res: Response) {
  try {
    const parsed = employerBulkMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    const result = await sendBulkEmployerMessages(req.user!.userId, parsed.data);
    return res.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function answerInterviewInvitationController(req: Request, res: Response) {
  try {
    const parsed = invitationResponseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    await answerInterviewInvitation(
      req.params.applicationId,
      req.params.messageId,
      req.user!.userId,
      parsed.data.response,
    );
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
}
