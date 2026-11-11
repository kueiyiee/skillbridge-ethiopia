import type { Request, Response } from 'express';
import { getPublicReportVerification } from './report-verification.service';

export async function verifyIssuedReportController(req: Request, res: Response) {
  const reportId = String(req.params.reportId ?? '');
  if (!/^RPT-[A-F0-9]{20}$/.test(reportId)) {
    return res.status(400).set('Cache-Control', 'no-store').json({ success: false, error: 'Invalid report verification code.' });
  }
  try {
    const report = await getPublicReportVerification(reportId);
    if (!report) {
      return res.status(404).set('Cache-Control', 'no-store').json({ success: false, valid: false, error: 'No issued report matches this verification code.' });
    }
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      valid: report.status === 'VALID',
      verification: report,
      notice: 'This endpoint confirms that SKILLBRIDGE ET issued a report record with the displayed metadata and SHA-256 report-data fingerprint. Compare the report ID and fingerprint printed on the document.',
    });
  } catch (error) {
    console.error('[report-verification] Verification lookup failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(503).set('Cache-Control', 'no-store').json({ success: false, error: 'Report verification is temporarily unavailable.' });
  }
}
