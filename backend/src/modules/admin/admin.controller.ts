import type { Request, Response } from 'express';
import { AdminError } from './admin.errors';
import { adminAuditQuerySchema, adminJobModerationSchema, adminJobsQuerySchema, adminRecordIdSchema, adminReportExportSchema, adminReportQuerySchema, adminUsersQuerySchema, adminVerificationsQuerySchema, userModerationSchema, verificationReviewSchema } from './admin.schemas';
import {
  getAdminMetrics,
  listAuditLogs,
  listAdminJobs,
  listUsers,
  listVerifications,
  getEmployerVerificationSummary,
  moderateAdminJob,
  moderateUser,
  reviewVerification,
} from './admin.service';
import type { AdminActor } from './admin.types';
import { getSystemStatus } from '../system/system.service';
import { getAdminReport } from './admin.reports';
import { createAdminReportSnapshot, getAdminReportSnapshot } from './admin.reports.cache';
import { createAdminReportFile } from './admin.reports.export';

function adminFromRequest(req: Request): AdminActor {
  return { userId: req.user!.userId, fullName: req.user!.fullName };
}

function handleError(res: Response, error: unknown) {
  if (error instanceof AdminError) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error('[admin] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

export async function listAdminJobsController(req: Request, res: Response) {
  try {
    const parsed = adminJobsQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid job query filters.' });
    return res.json({ success: true, ...(await listAdminJobs(parsed.data)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function moderateAdminJobController(req: Request, res: Response) {
  try {
    const id = adminRecordIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, error: 'Invalid job identifier.' });
    const parsed = adminJobModerationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'A valid job status and reason are required.' });
    return res.json({ success: true, ...(await moderateAdminJob(id.data, adminFromRequest(req), parsed.data)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getAdminReportController(req: Request, res: Response) {
  try {
    const parsed = adminReportQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid report type or filters.' });
    const report = await getAdminReport(parsed.data);
    const snapshotId = createAdminReportSnapshot(req.user!.userId, report);
    if (!snapshotId) return res.status(413).json({ success: false, error: 'Report preview is too large. Refine filters and try again.' });
    return res.set('Cache-Control', 'no-store').json({ success: true, data: report, snapshotId });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function exportAdminReportController(req: Request, res: Response) {
  try {
    const parsed = adminReportExportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid report export request.' });
    const report = getAdminReportSnapshot(parsed.data.snapshotId, req.user!.userId);
    if (!report) return res.status(404).json({ success: false, error: 'Report preview expired. Generate a new preview before exporting.' });
    const file = await createAdminReportFile(report, parsed.data.format);
    return res
      .set('Cache-Control', 'no-store, private')
      .set('Content-Type', file.contentType)
      .set('Content-Disposition', `attachment; filename="${file.filename}"`)
      .set('X-Report-Record-Count', String(report.includedRecords))
      .send(file.buffer);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listVerificationsController(req: Request, res: Response) {
  try {
    const parsed = adminVerificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid verification query filters.' });
    return res.json({ success: true, ...(await listVerifications(parsed.data)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployerVerificationSummaryController(_req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getEmployerVerificationSummary() });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function reviewVerificationController(req: Request, res: Response) {
  try {
    const id = adminRecordIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, error: 'Invalid verification record identifier.' });
    const parsed = verificationReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    }
    const result = await reviewVerification(id.data, adminFromRequest(req), parsed.data);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listUsersController(req: Request, res: Response) {
  try {
    const parsed = adminUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid user query filters.' });
    return res.json({ success: true, ...(await listUsers(parsed.data)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function moderateUserController(req: Request, res: Response) {
  try {
    const id = adminRecordIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, error: 'Invalid account identifier.' });
    const parsed = userModerationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'isActive boolean flag required' });
    const result = await moderateUser(id.data, adminFromRequest(req), parsed.data);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listAuditLogsController(req: Request, res: Response) {
  try {
    const parsed = adminAuditQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid audit query filters.' });
    return res.json({ success: true, ...(await listAuditLogs(parsed.data)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getAdminMetricsController(_req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getAdminMetrics() });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getAdminDiagnosticsController(_req: Request, res: Response) {
  try {
    return res.set('Cache-Control', 'no-store').json({ success: true, data: await getSystemStatus() });
  } catch (error) {
    return handleError(res, error);
  }
}
