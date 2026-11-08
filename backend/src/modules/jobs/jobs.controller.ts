import type { Request, Response } from 'express';
import { JobsError } from './jobs.errors';
import {
  jobApplicationSchema,
  jobCreationSchema,
  jobMatchWeightsSchema,
  jobSearchSchema,
  jobStatusSchema,
} from './jobs.schemas';
import {
  analyzeJobGap,
  applyForJob,
  createJob,
  getJob,
  listJobs,
  removeSavedJob,
  saveJob,
  updateJob,
  updateJobStatus,
} from './jobs.service';

function handleError(res: Response, error: unknown) {
  if (error instanceof JobsError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }

  console.error('[jobs] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function validationError(res: Response, details: unknown) {
  return res.status(400).json({ success: false, error: 'Validation failed', details });
}

export async function listJobsController(req: Request, res: Response) {
  try {
    const parsed = jobSearchSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error.format());
    const data = await listJobs(parsed.data);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getJobController(req: Request, res: Response) {
  try {
    const actor = req.user ? { userId: req.user.userId, role: req.user.role } : undefined;
    const data = await getJob(req.params.id, actor);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createJobController(req: Request, res: Response) {
  try {
    const parsed = jobCreationSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.format());
    const data = await createJob(req.user!, parsed.data);
    return res.status(201).json({ success: true, message: 'Job vacancy published successfully', data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateJobController(req: Request, res: Response) {
  try {
    const parsed = jobCreationSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.format());
    await updateJob(req.params.id, req.user!, parsed.data);
    return res.json({ success: true, message: 'Job posting updated successfully.' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateJobStatusController(req: Request, res: Response) {
  try {
    const parsed = jobStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid job status' });
    await updateJobStatus(req.params.id, req.user!.userId, parsed.data.status);
    return res.json({ success: true, message: `Job status updated to ${parsed.data.status}` });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function applyForJobController(req: Request, res: Response) {
  try {
    const parsed = jobApplicationSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationError(res, parsed.error.format());
    const data = await applyForJob(req.params.id, req.user!.userId, parsed.data);
    return res.status(201).json({ success: true, message: 'Application submitted successfully', data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function saveJobController(req: Request, res: Response) {
  try {
    await saveJob(req.params.id, req.user!.userId);
    return res.json({ success: true, message: 'Job saved to bookmarks' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function removeSavedJobController(req: Request, res: Response) {
  try {
    await removeSavedJob(req.params.id, req.user!.userId);
    return res.json({ success: true, message: 'Job removed from bookmarks' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function analyzeJobGapController(req: Request, res: Response) {
  try {
    const parsed = jobMatchWeightsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Matching weights must be numbers between 0 and 1.' });
    }
    const data = await analyzeJobGap(req.params.id, req.user!.userId, parsed.data);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}
