import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  applicationStatusUpdateSchema,
  candidateSearchSchema,
  employerReportExportQuerySchema,
  employerReportQuerySchema,
  employerReportTypeSchema,
  verificationSubmissionSchema,
} from './employers.schemas';
import { EmployerError } from './employers.errors';
import {
  getEmployerAnalytics,
  getEmployerApplications,
  getEmployerDashboard,
  getEmployerCandidateDetails,
  getEmployerReportExport,
  getEmployerReportPreview,
  getPublicEmployers,
  searchEmployerCandidates,
  submitEmployerVerification,
  updateEmployerApplicationStatus,
} from './employers.service';
import { createEmployerReportCsv } from './employers.reports';
import { createEmployerReportPdf } from './employers.reports.pdf';
import { issueReportIdentity } from '../report-verification/report-verification.service';

function handleError(res: Response, error: unknown) {
  if (error instanceof EmployerError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error('[employers] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function actor(req: Request) {
  return { userId: req.user!.userId };
}

export async function getPublicEmployersController(_req: Request, res: Response) {
  try {
    const data = await getPublicEmployers();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployerDashboardController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getEmployerDashboard(actor(req)) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function submitEmployerVerificationController(req: Request, res: Response) {
  try {
    const parsed = verificationSubmissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    const data = await submitEmployerVerification(actor(req), parsed.data);
    return res.status(201).json({
      success: true,
      message: 'Verification request submitted. Status is pending administrative audit.',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployerApplicationsController(req: Request, res: Response) {
  try {
    const data = await getEmployerApplications(actor(req));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function searchEmployerCandidatesController(req: Request, res: Response) {
  try {
    const parsed = candidateSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid candidate search filters.', details: parsed.error.format() });
    }
    return res.json({ success: true, ...await searchEmployerCandidates(actor(req), parsed.data) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployerCandidateDetailsController(req: Request, res: Response) {
  try {
    const parsed = z.string().min(1).max(191).safeParse(req.params.candidateId);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid candidate profile.' });
    return res.json({ success: true, data: await getEmployerCandidateDetails(actor(req), parsed.data) });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployerReportsController(_req: Request, res: Response) {
  return res.json({
    success: true,
    data: [
      { type: 'job-performance', label: 'Job performance', dateBasis: 'Application submission date' },
      { type: 'applications', label: 'Applications', dateBasis: 'Application submission date' },
      { type: 'pipeline', label: 'Recruitment pipeline', dateBasis: 'Application submission date' },
      { type: 'candidate-activity', label: 'Candidate activity', dateBasis: 'Application submission date' },
    ],
    supportedFormats: ['csv', 'pdf'],
  });
}

export async function getEmployerReportPreviewController(req: Request, res: Response) {
  try {
    const type = employerReportTypeSchema.safeParse(req.params.reportType);
    const filters = employerReportQuerySchema.safeParse(req.query);
    if (!type.success || !filters.success) {
      return res.status(400).json({ success: false, error: 'Invalid report type or filters.' });
    }
    return res.json({
      success: true,
      data: await getEmployerReportPreview(actor(req), type.data, filters.data),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function exportEmployerReportController(req: Request, res: Response) {
  try {
    const type = employerReportTypeSchema.safeParse(req.params.reportType);
    const filters = employerReportExportQuerySchema.safeParse(req.query);
    if (!type.success || !filters.success) {
      return res.status(400).json({ success: false, error: 'Invalid report type, date range, or export format.' });
    }
    const report = await getEmployerReportExport(actor(req), type.data, filters.data);
    const generatedAt = new Date().toISOString();
    const titles: Record<string, string> = {
      'job-performance': 'Job Performance',
      applications: 'Applications Register',
      pipeline: 'Recruitment Pipeline',
      'candidate-activity': 'Candidate Activity',
    };
    const title = titles[type.data];
    const date = generatedAt.slice(0, 10);
    const baseName = `SKILLBRIDGE_ET_Employer_${type.data}_${date}`;

    if (filters.data.format === 'pdf') {
      const verification = await issueReportIdentity({
        issuerUserId: req.user!.userId,
        issuerRole: 'EMPLOYER',
        employerId: report.employerId,
        reportType: type.data,
        reportTitle: title,
        generatedAt,
        recordCount: report.total,
        reportPayload: {
          type: type.data,
          title,
          generatedAt,
          period: filters.data,
          employerId: report.employerId,
          total: report.total,
          summary: report.summary,
          columns: report.columns,
          rows: report.rows,
          truncated: report.truncated,
        },
      });
      const buffer = await createEmployerReportPdf({
        reportId: verification.id,
        verificationUrl: verification.verificationUrl,
        reportHash: verification.reportHash,
        title,
        generatedAt,
        startDate: filters.data.startDate,
        endDate: filters.data.endDate,
        employerId: report.employerId,
        totalRecords: report.total,
        truncated: report.truncated,
        summary: report.summary,
        columns: report.columns,
        rows: report.rows,
      });
      return res.set({
        'Cache-Control': 'no-store, private',
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        'X-Report-Record-Count': String(report.rows.length),
        'X-Report-Truncated': String(report.truncated),
        'X-Report-Verification-Id': verification.id,
      }).send(buffer);
    }

    const csv = createEmployerReportCsv(type.data, generatedAt, filters.data, report.columns, report.rows);
    return res.set({
      'Cache-Control': 'no-store, private',
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${baseName}.csv"`,
      'X-Report-Record-Count': String(report.rows.length),
      'X-Report-Truncated': String(report.truncated),
    }).send(csv);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateEmployerApplicationStatusController(req: Request, res: Response) {
  try {
    const parsed = applicationStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
    const result = await updateEmployerApplicationStatus(req.params.id, actor(req), parsed.data);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployerAnalyticsController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getEmployerAnalytics(actor(req)) });
  } catch (error) {
    return handleError(res, error);
  }
}
