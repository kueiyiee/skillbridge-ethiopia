import type { Request, Response } from 'express';
import { CandidateError } from './candidates.errors';
import {
  candidateProfileUpdateSchema,
  candidateSkillSchema,
  candidateSkillUpdateSchema,
  skillAssessmentSubmissionSchema,
} from './candidates.schemas';
import {
  addMySkill,
  getMySkills,
  getMyApplications,
  getMyLearningPath,
  getMyProfile,
  getMyRecommendations,
  getMySavedJobs,
  getMySkillAssessments,
  getMySkillAssessmentQuestions,
  removeMySkill,
  submitMySkillAssessment,
  updateMySkill,
  updateMyProfile,
} from './candidates.service';

function handleError(res: Response, error: unknown) {
  if (error instanceof CandidateError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error('[candidates] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function actor(req: Request) {
  return { userId: req.user!.userId };
}

export async function getMyProfileController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getMyProfile(actor(req)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateMyProfileController(req: Request, res: Response) {
  try {
    const parsed = candidateProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    await updateMyProfile(actor(req), parsed.data);
    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function addMySkillController(req: Request, res: Response) {
  try {
    const parsed = candidateSkillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    await addMySkill(actor(req), parsed.data);
    return res.status(201).json({ success: true, message: 'Skill registered to candidate profile' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMySkillsController(req: Request, res: Response) {
  try {
    const data = await getMySkills(actor(req));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateMySkillController(req: Request, res: Response) {
  try {
    const parsed = candidateSkillUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    await updateMySkill(actor(req), req.params.id, parsed.data);
    return res.json({ success: true, message: 'Skill updated' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function removeMySkillController(req: Request, res: Response) {
  try {
    await removeMySkill(actor(req), req.params.id);
    return res.json({ success: true, message: 'Skill removed' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMySkillAssessmentsController(req: Request, res: Response) {
  try {
    const data = await getMySkillAssessments(actor(req));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMySkillAssessmentQuestionsController(req: Request, res: Response) {
  try {
    const data = await getMySkillAssessmentQuestions(actor(req), req.params.id);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function submitMySkillAssessmentController(req: Request, res: Response) {
  try {
    const parsed = skillAssessmentSubmissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    const data = await submitMySkillAssessment(actor(req), req.params.id, parsed.data);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMyApplicationsController(req: Request, res: Response) {
  try {
    const result = await getMyApplications(actor(req));
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMySavedJobsController(req: Request, res: Response) {
  try {
    const result = await getMySavedJobs(actor(req));
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMyRecommendationsController(req: Request, res: Response) {
  try {
    const data = await getMyRecommendations(actor(req));
    return res.json({
      success: true,
      count: data.length,
      data,
      explanation: 'Recommendations ranked deterministically by skill proficiency match (70%) and experience alignment (30%). No sensitive attributes are used.',
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getMyLearningPathController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getMyLearningPath(actor(req)) });
  } catch (error) {
    return handleError(res, error);
  }
}
