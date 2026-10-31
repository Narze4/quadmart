import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { consumeQuota } from './limits.mjs';
import { assertActive, moderator, SafetyError } from './safety.mjs';
import { getUniversityFromEmail } from '../universities.js';

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MIME_FORMATS = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
async function activeAccount(db, reader, ...uids) {
  try { await assertActive(db, reader, ...uids); }
  catch (error) { if (error instanceof SafetyError) throw new UploadError(error.message, error.status); throw error; }
}
const hash = value => createHash('sha256').update(value).digest('hex');
export class UploadError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function readPhoto(request) {
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_PHOTO_BYTES) throw new UploadError('Each photo must be 3 MB or smaller.', 413);
  if (!request.body) throw new UploadError('Choose a photo to upload.');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PHOTO_BYTES) {
        await reader.cancel();
        throw new UploadError('Each photo must be 3 MB or smaller.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new UploadError('The photo is empty.');
  return Buffer.concat(chunks, size);
}

export async function sanitizePhoto(bytes, mime) {
  try {
    const input = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning', animated: true });
    const meta = await input.metadata();
    if (!MIME_FORMATS[mime] || meta.format !== MIME_FORMATS[mime] || (meta.pages ?? 1) !== 1) {
      throw new UploadError('Choose a static JPG, PNG, or WebP photo.');
    }
    // Full decode/re-encode rejects malformed input and drops EXIF/GPS metadata.
    const { data, info } = await input.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).timeout({ seconds: 8 }).toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError('This photo could not be read. Choose a JPG, PNG, or WebP under 25 megapixels.');
  }
}

export async function uploadPhoto(request, { auth, db, storeImage, projectId, now = Date.now() }) {
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new UploadError('Sign in to upload photos.', 401);
  let actor;
  try { actor = await auth.verifyIdToken(bearer.slice(7), true); }
  catch { throw new UploadError('Your sign-in expired. Please log in again.', 401); }
  const university = getUniversityFromEmail(actor.email);
  if (!actor.email_verified || !university) throw new UploadError('Verify your supported university email before uploading photos.', 403);
  await consumeQuota(db, actor.uid, 'uploadAttempt', now);
  await activeAccount(db, db, actor.uid);
  const mime = request.headers.get('content-type')?.toLowerCase();
  if (!MIME_FORMATS[mime]) throw new UploadError('Choose a JPG, PNG, or WebP photo.', 415);
  const requestId = request.headers.get('x-upload-id');
  if (!requestId || !/^[a-zA-Z0-9_-]{20,80}$/.test(requestId)) throw new UploadError('Invalid upload request.');
  const bytes = await readPhoto(request);
  const digest = hash(bytes);
  const mediaId = hash(`${actor.uid}:${requestId}`);
  const media = db.doc(`media/${mediaId}`);
  const userQuota = db.doc(`uploadLimits/${hash(actor.uid)}`);
  const globalQuota = db.doc('uploadLimits/global');
  const day = Math.floor(now / 86400000), minute = Math.floor(now / 60000);
  const publicId = `quadmart/${projectId}/${hash(actor.uid).slice(0,24)}/${mediaId}`;
  const existing = await db.runTransaction(async tx => {
    await activeAccount(db, tx, actor.uid);
    const [old, user, total, profile] = await Promise.all([
      tx.get(media), tx.get(userQuota), tx.get(globalQuota), tx.get(db.doc(`users/${actor.uid}`)),
    ]);
    if (!profile.exists || profile.data().campusId !== university.domain) throw new UploadError('Finish account setup before uploading.', 403);
    if (old.exists) {
      if (old.data().digest !== digest) throw new UploadError('Upload ID already used for a different photo.', 409);
      if (old.data().status === 'ready') return { id: mediaId, url: old.data().url };
      throw new UploadError(old.data().status === 'pending' ? 'This photo is still uploading. Please wait and retry.' : 'This upload failed. Remove the photo and select it again.', 409);
    }
    const daily = user.data()?.day === day ? user.data().daily : 0;
    const recent = user.data()?.minute === minute ? user.data().recent : 0;
    const globalDaily = total.data()?.day === day ? total.data().daily : 0;
    // Count attempts, including invalid images/storage failures. Transactions share
    // these budgets across concurrent server instances, not just one process.
    if (daily >= 20 || recent >= 10 || globalDaily >= 200) throw new UploadError('Photo upload limit reached. Please try again later.', 429);
    tx.set(userQuota, { day, daily: daily + 1, minute, recent: recent + 1 });
    tx.set(globalQuota, { day, daily: globalDaily + 1 });
    tx.create(media, { ownerUid: actor.uid, campusId: university.domain, digest, publicId, status: 'pending', createdAt: new Date(now) });
    return null;
  });
  if (existing) return existing;
  try {
    const cleaned = await sanitizePhoto(bytes, mime);
    const result = await storeImage(cleaned.bytes, publicId);
    const url = new URL(result.secure_url);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || result.public_id !== publicId || result.asset_folder !== `quadmart/${projectId}` || result.resource_type !== 'image' || result.type !== 'authenticated' || result.format !== 'jpg') {
      throw new Error('Unexpected image storage response');
    }
    const photoUrl = `/api/photos/${mediaId}`;
    await db.runTransaction(async tx => {
      await activeAccount(db, tx, actor.uid);
      const current = await tx.get(media);
      if (current.data()?.status !== 'pending') throw new UploadError('This upload is no longer available.',409);
      tx.update(media, { status: 'ready', url: photoUrl, width: cleaned.width, height: cleaned.height, bytes: cleaned.bytes.length });
    });
    return { id: mediaId, url: photoUrl };
  } catch (error) {
    // Retain the server-generated ID so failed/abandoned assets can be reconciled.
    await db.runTransaction(async tx => {
      const current = await tx.get(media);
      if (current.data()?.status === 'pending') tx.update(media, { status: 'failed' });
    });
    if (error instanceof UploadError) throw error;
    throw new UploadError('Photo storage is temporarily unavailable. Remove the photo and retry later.', 503);
  }
}

export async function authorizePhoto(request, id, { auth, db, now = Date.now() }) {
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new UploadError('Sign in required.', 401);
  let actor;
  try { actor = await auth.verifyIdToken(bearer.slice(7), true); }
  catch { throw new UploadError('Invalid sign-in.', 401); }
  const campus = getUniversityFromEmail(actor.email)?.domain;
  if (!actor.email_verified || !campus) throw new UploadError('University verification required.', 403);
  if (!/^[a-f0-9]{64}$/.test(id)) throw new UploadError('Photo not found.', 404);
  await consumeQuota(db, actor.uid, 'photo', now);
  await activeAccount(db, db, actor.uid);
  const asset = await db.doc(`media/${id}`).get();
  if (!asset.exists || asset.data().campusId !== campus) throw new UploadError('Photo not found.', 404);
  const reviewer = await moderator(db, db, actor.uid, campus);
  if (asset.data().status !== 'ready' && !(reviewer && asset.data().status === 'blocked')) throw new UploadError('Photo not found.', 404);
  if (!reviewer) await activeAccount(db, db, asset.data().ownerUid);
  return asset.data();
}
