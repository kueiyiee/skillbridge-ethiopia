import type { Request, Response } from 'express';
import { AiNexusError } from './ai-nexus.errors';
import { aiSkillAdvisorSchema, cvAnalysisRequestSchema, jobEnhancerSchema, nexusQuerySchema } from './ai-nexus.schemas';
import {
  analyzeCandidateCv,
  deleteNexusConversation,
  enhanceJobDescription,
  getNexusConversation,
  getNexusConversations,
  getSkillGapAdvice,
  queryNexus,
} from './ai-nexus.service';
import type { AiActor } from './ai-nexus.types';

function actor(req: Request): AiActor {
  return {
    userId: req.user!.userId,
    email: req.user!.email,
    role: req.user!.role,
    fullName: req.user!.fullName,
  };
}

function responseAbortSignal(res: Response): AbortSignal {
  const controller = new AbortController();
  if (res.destroyed) {
    controller.abort();
  } else {
    res.once('close', () => {
      if (!res.writableEnded) controller.abort();
    });
  }
  return controller.signal;
}

function handleError(res: Response, error: unknown, fallback = 'Internal AI service error') {
  if (res.destroyed) return res;
  if (error instanceof AiNexusError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error('[AI Nexus] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: fallback });
}

export async function listConversationsController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getNexusConversations(actor(req)) });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch conversations');
  }
}

export async function getConversationController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getNexusConversation(req.params.id, actor(req)) });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch conversation history');
  }
}

export async function queryNexusController(req: Request, res: Response) {
  try {
    const parsed = nexusQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Message content must be between 1 and 4000 characters.' });
    }
    return res.json({ success: true, ...(await queryNexus(actor(req), parsed.data, responseAbortSignal(res))) });
  } catch (error) {
    return handleError(res, error, 'Internal AI Nexus error');
  }
}

function writeSseEvent(res: Response, event: string, payload: unknown): void {
  if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function streamQueryNexusController(req: Request, res: Response) {
  const parsed = nexusQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Message content must be between 1 and 4000 characters.' });
  }

  const signal = responseAbortSignal(res);
  res.status(200).set({
    'Cache-Control': 'no-store, no-transform',
    'Content-Type': 'text/event-stream; charset=utf-8',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  writeSseEvent(res, 'start', {});

  try {
    const result = await queryNexus(actor(req), parsed.data, signal, {
      onConversationId: (conversationId) => writeSseEvent(res, 'conversation', { conversationId }),
      onTextDelta: (text) => writeSseEvent(res, 'delta', { text }),
      onTextReset: () => writeSseEvent(res, 'reset', {}),
    });
    writeSseEvent(res, 'done', { success: true, ...result });
  } catch (error) {
    if (signal.aborted || res.destroyed) return;
    console.error('[AI Nexus] Stream request failed:', error instanceof Error ? error.name : 'UnknownError');
    writeSseEvent(res, 'reset', {});
    const statusCode = error instanceof AiNexusError ? error.statusCode : 500;
    writeSseEvent(res, 'error', {
      error: error instanceof AiNexusError ? error.message : 'AI request failed. Please retry.',
      retryable: statusCode === 429 || statusCode >= 500,
    });
  }

  if (!res.destroyed) res.end();
}

export async function deleteConversationController(req: Request, res: Response) {
  try {
    await deleteNexusConversation(req.params.id, actor(req));
    return res.json({ success: true, message: 'Conversation deleted.' });
  } catch (error) {
    return handleError(res, error, 'Failed to delete conversation');
  }
}

export async function skillGapAdvisorController(req: Request, res: Response) {
  try {
    const parsed = aiSkillAdvisorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    }
    return res.json({ success: true, ...(await getSkillGapAdvice(actor(req), parsed.data, responseAbortSignal(res))) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function jobEnhancerController(req: Request, res: Response) {
  try {
    const parsed = jobEnhancerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    }
    return res.json({ success: true, ...(await enhanceJobDescription(parsed.data, responseAbortSignal(res))) });
  } catch (error) {
    return handleError(res, error, 'Error processing job enhancer');
  }
}

export async function cvAnalysisController(req: Request, res: Response) {
  try {
    const parsed = cvAnalysisRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Provide 80-12000 characters of CV text and valid optional role details.' });
    }
    return res.json({ success: true, ...(await analyzeCandidateCv(actor(req), parsed.data, responseAbortSignal(res))) });
  } catch (error) {
    return handleError(res, error, 'CV analysis is temporarily unavailable. Please retry.');
  }
}
