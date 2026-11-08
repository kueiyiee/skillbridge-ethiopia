import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { adminRecordIdSchema } from './admin.schemas';
import {
  adminManagementCreateSchema,
  adminManagementEntitySchema,
  adminManagementQuerySchema,
  adminManagementUpdateSchema,
} from './admin.management.schemas';
import {
  archiveManagedRecord,
  createManagedRecord,
  getManagementOptions,
  listManagedRecords,
  restoreManagedRecord,
  updateManagedRecord,
} from './admin.management.repository';

function respondWithError(res: Response, error: unknown) {
  const statusCode = error instanceof Error && 'statusCode' in error
    ? Number((error as Error & { statusCode: number }).statusCode)
    : 500;
  if (statusCode >= 400 && statusCode < 500 && error instanceof Error) {
    return res.status(statusCode).json({ success: false, error: error.message });
  }
  console.error('[admin] Management request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function adminActor(req: Request) {
  return { userId: req.user!.userId, fullName: req.user!.fullName };
}

export async function getManagementOptionsController(_req: Request, res: Response) {
  try {
    return res.set('Cache-Control', 'no-store').json({ success: true, data: await getManagementOptions() });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function listManagedRecordsController(req: Request, res: Response) {
  try {
    const entity = adminManagementEntitySchema.safeParse(req.params.entity);
    const filters = adminManagementQuerySchema.safeParse(req.query);
    if (!entity.success || !filters.success) return res.status(400).json({ success: false, error: 'Invalid management query.' });
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      ...(await listManagedRecords(entity.data, filters.data)),
    });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function createManagedRecordController(req: Request, res: Response) {
  try {
    if (req.params.entity === 'verifications') {
      return res.status(409).json({ success: false, error: 'Verification records can only be submitted or reviewed through Employer Verification.' });
    }
    const parsed = adminManagementCreateSchema.safeParse({ entity: req.params.entity, data: req.body });
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid record data.', details: parsed.error.format() });
    }
    const data: Record<string, unknown> = { ...parsed.data.data };
    if (parsed.data.entity === 'users') {
      data.passwordHash = await bcrypt.hash(String(data.password), 12);
      delete data.password;
    }
    const result = await createManagedRecord(parsed.data.entity, data, adminActor(req));
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function updateManagedRecordController(req: Request, res: Response) {
  try {
    if (req.params.entity === 'verifications') {
      return res.status(409).json({ success: false, error: 'Verification records can only be reviewed through Employer Verification.' });
    }
    const entity = adminManagementEntitySchema.safeParse(req.params.entity);
    const id = adminRecordIdSchema.safeParse(req.params.id);
    if (!entity.success) return res.status(400).json({ success: false, error: 'Invalid record type.' });
    if (!id.success) return res.status(400).json({ success: false, error: 'Invalid record identifier.' });
    const parsed = adminManagementUpdateSchema.safeParse({ entity: entity.data, data: req.body });
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid record data.', details: parsed.error.format() });
    }
    const result = await updateManagedRecord(parsed.data.entity, id.data, { ...parsed.data.data }, adminActor(req));
    return res.json({ success: true, data: result });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function archiveManagedRecordController(req: Request, res: Response) {
  try {
    if (req.params.entity === 'verifications') {
      return res.status(409).json({ success: false, error: 'Verification history cannot be archived through Data Management.' });
    }
    const entity = adminManagementEntitySchema.safeParse(req.params.entity);
    const id = adminRecordIdSchema.safeParse(req.params.id);
    if (!entity.success) return res.status(400).json({ success: false, error: 'Invalid record type.' });
    if (!id.success) return res.status(400).json({ success: false, error: 'Invalid record identifier.' });
    await archiveManagedRecord(entity.data, id.data, adminActor(req));
    return res.json({ success: true, message: 'Record archived. Related history has been preserved.' });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function restoreManagedRecordController(req: Request, res: Response) {
  try {
    if (req.params.entity === 'verifications') {
      return res.status(409).json({ success: false, error: 'Verification history cannot be restored through Data Management.' });
    }
    const entity = adminManagementEntitySchema.safeParse(req.params.entity);
    const id = adminRecordIdSchema.safeParse(req.params.id);
    if (!entity.success) return res.status(400).json({ success: false, error: 'Invalid record type.' });
    if (!id.success) return res.status(400).json({ success: false, error: 'Invalid record identifier.' });
    await restoreManagedRecord(entity.data, id.data, adminActor(req));
    return res.json({ success: true, message: 'Record restored.' });
  } catch (error) {
    return respondWithError(res, error);
  }
}
