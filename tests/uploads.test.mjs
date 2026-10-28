import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { uploadPhoto, sanitizePhoto, readPhoto, authorizePhoto, MAX_PHOTO_BYTES } from '../lib/server/uploads.mjs';
import { verificationSettings } from '../lib/email-verification.mjs';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Local Firestore emulator required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'upload-tests');
const db = getFirestore(app);
const actor = { uid: 'photo-seller', email: 'photo-seller@emory.edu', email_verified: true };
const auth = { verifyIdToken: async (token, revoked) => { assert.equal(revoked, true); if (token !== 'test-token') throw Error('Bad token'); return actor; } };
let png, stored;
const now = 1793145600000;
const request = (body = png, headers = {}) => new Request('http://localhost/api/upload', {
  method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'image/png', 'x-upload-id': randomUUID(), ...headers }, body,
});
const storeImage = async (bytes, publicId) => {
  stored.push({ bytes, publicId });
  return { secure_url: `https://res.cloudinary.com/test/image/authenticated/${publicId}.jpg`, public_id: publicId, asset_folder: 'quadmart/demo-quadmart', type: 'authenticated', resource_type: 'image', format: 'jpg' };
};
const deps = () => ({ auth, db, storeImage, projectId: 'demo-quadmart', now });
const rejects = (fn, status) => assert.rejects(fn, error => error.status === status);
before(async () => { png = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: '#15704f' } }).png().toBuffer(); });
beforeEach(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
  await db.doc('users/photo-seller').set({ campusId: 'emory.edu' });
  stored = [];
});
after(async () => { await db.terminate(); await deleteApp(app); });
test('auth, verified email and supported campus are required before storage', async () => {
  await rejects(() => uploadPhoto(request(png, { authorization: '' }), deps()), 401);
  await rejects(() => uploadPhoto(request(png, { authorization: 'Bearer bad' }), deps()), 401);
  for (const user of [{ ...actor, email_verified: false }, { ...actor, email: 'test@gmail.com' }]) {
    await rejects(() => uploadPhoto(request(), { ...deps(), auth: { verifyIdToken: async () => user } }), 403);
  }
  assert.equal(stored.length, 0);
});
test('missing or changed campus profiles cannot upload or consume storage', async () => {
  await db.doc('users/photo-seller').delete();
  await rejects(() => uploadPhoto(request(), deps()), 403);
  await db.doc('users/photo-seller').set({ campusId: 'uga.edu' });
  await rejects(() => uploadPhoto(request(), deps()), 403);
  assert.equal(stored.length, 0);
  assert.equal((await db.collection('media').get()).size, 0);
});
test('body limit is enforced even with a missing or lying content-length', async () => {
  await rejects(() => readPhoto(request(Buffer.alloc(MAX_PHOTO_BYTES + 1), { 'content-length': '1' })), 413);
  await rejects(() => readPhoto(request(png, { 'content-length': String(MAX_PHOTO_BYTES + 1) })), 413);
  await rejects(() => readPhoto(request(Buffer.alloc(0))), 400);
});
test('rejects spoofed MIME, SVG, truncated data and huge pixel dimensions', async () => {
  await rejects(() => sanitizePhoto(png, 'image/jpeg'), 400);
  await rejects(() => sanitizePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), 'image/png'), 400);
  await rejects(() => sanitizePhoto(png.subarray(0, 50), 'image/png'), 400);
  const giant = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
  await rejects(() => sanitizePhoto(giant, 'image/png'), 400);
  await rejects(() => uploadPhoto(request(png, { 'content-type': 'image/svg+xml' }), deps()), 415);
  assert.equal(stored.length, 0);
});
test('re-encodes, shrinks and strips metadata from valid photos', async () => {
  const withExif = await sharp(png).withExif({ IFD0: { Artist: 'Private owner', Copyright: 'Private metadata' } }).jpeg().toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif);
  const cleaned = await sanitizePhoto(withExif, 'image/jpeg');
  const meta = await sharp(cleaned.bytes).metadata();
  assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, 1600);
  assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined); assert.equal(meta.icc, undefined);
});
test('valid upload stores an owner-bound private asset; identical retry does not upload twice', async () => {
  const id = randomUUID();
  const send = () => uploadPhoto(request(png, { 'x-upload-id': id }), deps());
  const asset = await send();
  assert.deepEqual(await send(), asset); assert.equal(stored.length, 1);
  assert.equal(asset.url, `/api/photos/${asset.id}`);
  const record = (await db.doc(`media/${asset.id}`).get()).data();
  assert.equal(record.ownerUid, actor.uid); assert.equal(record.campusId, 'emory.edu'); assert.equal(record.status, 'ready');
  assert.equal((await sharp(stored[0].bytes).metadata()).format, 'jpeg');
  await rejects(() => uploadPhoto(request(Buffer.from('different'), { 'x-upload-id': id }), deps()), 409);
});
test('concurrent attempts for one upload produce at most one stored object', async () => {
  const id = randomUUID();
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => uploadPhoto(request(png, { 'x-upload-id': id }), deps())));
  assert.ok(results.some(x => x.status === 'fulfilled')); assert.equal(stored.length, 1);
  for (const r of results) if (r.status === 'rejected') assert.equal(r.reason.status, 409);
});
test('parallel rate-limit requests cannot exceed the shared budget', async () => {
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => uploadPhoto(request(), deps())));
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 10);
  assert.equal(results.filter(x => x.status === 'rejected' && x.reason.status === 429).length, 2);
  assert.equal(stored.length, 10);
});
test('daily user and global caps reject before storage', async () => {
  const uidHash = createHash('sha256').update(actor.uid).digest('hex');
  await db.doc(`uploadLimits/${uidHash}`).set({ day: Math.floor(now / 86400000), daily: 20 });
  await rejects(() => uploadPhoto(request(), deps()), 429);
  await db.doc(`uploadLimits/${uidHash}`).set({});
  await db.doc('uploadLimits/global').set({ day: Math.floor(now / 86400000), daily: 200 });
  await rejects(() => uploadPhoto(request(), deps()), 429); assert.equal(stored.length, 0);
});
test('failed storage never makes an attachable asset and does not expose provider errors', async () => {
  await assert.rejects(() => uploadPhoto(request(), { ...deps(), storeImage: async () => { throw Error('secret-provider-detail'); } }), error => error.status === 503 && !error.message.includes('secret'));
  const media = await db.collection('media').get(); assert.equal(media.size, 1); assert.equal(media.docs[0].data().status, 'failed');
});
test('unexpected or public storage responses never become attachable photos', async () => {
  for (const change of [
    { type: 'upload' }, { public_id: 'someone-elses-photo' },
    { secure_url: 'https://untrusted.example/photo.jpg' }, { format: 'svg' }, { asset_folder: 'unrelated-folder' },
  ]) {
    await rejects(() => uploadPhoto(request(), {
      ...deps(), storeImage: async (bytes, publicId) => ({ ...await storeImage(bytes, publicId), ...change }),
    }), 503);
  }
  const media = await db.collection('media').get();
  assert.equal(media.size, 5);
  assert.ok(media.docs.every(asset => asset.data().status === 'failed' && !asset.data().url));
});
test('photo reads require verified same-campus membership and ready status', async () => {
  const asset = await uploadPhoto(request(), deps());
  const read = (user) => authorizePhoto(request(), asset.id, { db, auth: { verifyIdToken: async () => user } });
  assert.equal((await read({ ...actor, uid: 'buyer' })).status, 'ready');
  await rejects(() => authorizePhoto(request(png, { authorization: '' }), asset.id, deps()), 401);
  await rejects(() => read({ ...actor, email_verified: false }), 403);
  await rejects(() => read({ ...actor, email: 'buyer@uga.edu' }), 404);
  await db.doc(`media/${asset.id}`).update({ status: 'failed' });
  await rejects(() => read(actor), 404);
});
test('verification links return to the app without exposing email in the URL', () => {
  assert.deepEqual(verificationSettings('https://quadmart.example/path?email=ignored'), { url: 'https://quadmart.example/verify-email', handleCodeInApp: false });
  assert.throws(() => verificationSettings('javascript:alert(1)'));
  assert.throws(() => verificationSettings('http://untrusted.example'));
  assert.throws(() => verificationSettings('https://user:secret@example.com'));
});
