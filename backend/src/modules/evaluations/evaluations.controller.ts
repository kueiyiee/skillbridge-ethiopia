import type { Request, Response } from 'express';
import { evaluationSubmissionSchema } from './evaluations.schemas';
import { EvaluationError } from './evaluations.errors';
import { getEvaluations, submitEvaluation } from './evaluations.service';
import type { EvaluationActor } from './evaluations.types';

function actorFromRequest(req: Request): EvaluationActor {
  return { userId: req.user!.userId, role: req.user!.role };
}

function handleError(res: Response, error: unknown) {
  if (error instanceof EvaluationError) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error('[evaluations] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

export async function getEvaluationsController(req: Request, res: Response) {
  try {
    const data = await getEvaluations(actorFromRequest(req));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function submitEvaluationController(req: Request, res: Response) {
  try {
    const parsed = evaluationSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    }
    const data = await submitEvaluation(actorFromRequest(req), parsed.data);
    return res.status(201).json({
      success: true,
      message: 'Performance evaluation recorded',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
