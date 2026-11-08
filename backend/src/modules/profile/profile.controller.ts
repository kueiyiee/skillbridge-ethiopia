import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import { profileImageSchema, profileUpdateSchema } from './profile.schemas';
import { getAccountProfile, ProfileConflictError, removeProfileImage, updateAccountProfile, updateProfileImage } from './profile.repository';

const mediaDirectory = () => path.resolve(process.env.PROFILE_MEDIA_DIRECTORY || path.join(process.cwd(), 'data', 'profile-media'));
const mediaUrlPattern = /^\/api\/profile\/media\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/i;
const imageLimit = Math.min(5 * 1024 * 1024, Math.max(256 * 1024, Number(process.env.PROFILE_IMAGE_MAX_BYTES) || 2 * 1024 * 1024));

function detectImage(buffer: Buffer): { extension: string; contentType: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ProfileConflictError) return res.status(409).json({ success: false, error: error.message });
  console.error('[profile] Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ success: false, error: 'Profile request failed. Please try again.' });
}

export async function getMyProfileController(req: Request, res: Response) {
  try {
    const profile = await getAccountProfile(req.user!);
    if (!profile) return res.status(404).json({ success: false, error: 'Account profile not found.' });
    return res.set('Cache-Control', 'no-store').json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateMyProfileController(req: Request, res: Response) {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || 'profile';
    return res.status(400).json({ success: false, error: `${field}: ${issue?.message || 'Please review this field and try again.'}` });
  }
  if (parsed.data.gender === 'SELF_DESCRIBED' && !parsed.data.genderDescription?.trim()) {
    return res.status(400).json({ success: false, error: 'Enter your self-described gender, or choose another option.' });
  }
  try {
    await updateAccountProfile(req.user!, parsed.data);
    const profile = await getAccountProfile(req.user!);
    return res.set('Cache-Control', 'no-store').json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function uploadMyProfileImageController(req: Request, res: Response) {
  const parsed = profileImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Choose a JPG, PNG, or WebP image under the upload limit.' });

  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(parsed.data.data)) {
    return res.status(400).json({ success: false, error: 'The image data is invalid.' });
  }
  const bytes = Buffer.from(parsed.data.data, 'base64');
  if (!bytes.length || bytes.length > imageLimit) {
    return res.status(413).json({ success: false, error: `Images must be ${Math.ceil(imageLimit / 1024 / 1024)} MB or smaller.` });
  }
  const image = detectImage(bytes);
  if (!image) return res.status(415).json({ success: false, error: 'Only valid JPG, PNG, and WebP images are supported.' });

  const filename = `${randomUUID()}.${image.extension}`;
  const url = `/api/profile/media/${filename}`;
  try {
    await mkdir(mediaDirectory(), { recursive: true });
    await writeFile(path.join(mediaDirectory(), filename), bytes, { flag: 'wx', mode: 0o600 });
    const existing = await getAccountProfile(req.user!);
    const account = existing?.user as Record<string, unknown> | undefined;
    const oldUrl = String(parsed.data.kind === 'avatar' ? account?.avatarUrl || '' : account?.coverUrl || '') || null;
    await updateProfileImage(req.user!.userId, parsed.data.kind, url);
    await deleteStoredImage(oldUrl);
    return res.status(201).json({ success: true, data: { kind: parsed.data.kind, url } });
  } catch (error) {
    await unlink(path.join(mediaDirectory(), filename)).catch(() => undefined);
    return sendError(res, error);
  }
}

async function deleteStoredImage(url: string | null) {
  if (!url) return;
  const match = mediaUrlPattern.exec(url);
  if (!match) return;
  await unlink(path.join(mediaDirectory(), match[1])).catch(() => undefined);
}

export async function removeMyProfileImageController(req: Request, res: Response) {
  const kind = req.params.kind;
  if (kind !== 'avatar' && kind !== 'cover') return res.status(400).json({ success: false, error: 'Unknown image type.' });
  try {
    const url = await removeProfileImage(req.user!.userId, kind);
    await deleteStoredImage(url);
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getProfileMediaController(req: Request, res: Response) {
  const filename = req.params.filename;
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(filename)) return res.status(404).end();
  try {
    const bytes = await readFile(path.join(mediaDirectory(), filename));
    const image = detectImage(bytes);
    if (!image) return res.status(404).end();
    return res.set({
      'Content-Type': image.contentType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    }).send(bytes);
  } catch {
    return res.status(404).end();
  }
}