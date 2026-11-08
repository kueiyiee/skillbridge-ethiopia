import type { Request, Response } from 'express';
import { getSkillCatalog, getSystemStatus, isDatabaseReady } from './system.service';

export async function databaseReadinessController(_req: Request, res: Response) {
  const ready = await isDatabaseReady();
  if (!ready) {
    return res.status(503).json({ status: 'not_ready', database: 'unavailable', timestamp: new Date().toISOString() });
  }
  return res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
}

export async function getSystemStatusController(_req: Request, res: Response) {
  try {
    const data = await getSystemStatus();
    return res.json({ success: true, data });
  } catch {
    return res.status(503).json({ success: false, error: 'Database status is unavailable.' });
  }
}

export async function getSkillCatalogController(_req: Request, res: Response) {
  try {
    const result = await getSkillCatalog();
    return res.json({ success: true, ...result });
  } catch {
    return res.status(503).json({ success: false, error: 'Skills are temporarily unavailable.' });
  }
}
