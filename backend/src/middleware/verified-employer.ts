import type { NextFunction, Request, Response } from 'express';
import { db } from '../infrastructure/database/drizzle';

export async function requireVerifiedEmployer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await db.query<{ id: string; isApproved: boolean }>(
      `SELECT e.id, e."isApproved"
       FROM employer_profiles e
       JOIN users u ON u.id = e."userId"
       WHERE u.id = $1 AND u.role = 'EMPLOYER' AND u."isActive" = true
         AND u."archivedAt" IS NULL AND e."archivedAt" IS NULL`,
      [req.user!.userId],
    );
    if (!result.rows[0] || !result.rows[0].isApproved) {
      return res.status(403).json({
        success: false,
        verificationPending: true,
        error: 'Complete employer business verification before using recruiting features.',
      });
    }
    return next();
  } catch (error) {
    console.error('[employer-verification] Recruiting access check failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ success: false, error: 'Employer verification status could not be checked.' });
  }
}

export async function requireVerifiedEmployerWhenApplicable(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'EMPLOYER') return next();
  return requireVerifiedEmployer(req, res, next);
}
