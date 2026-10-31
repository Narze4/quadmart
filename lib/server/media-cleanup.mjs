import { createHash } from 'node:crypto';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';
export const MEDIA_GRACE_MS = 24 * 60 * 60 * 1000;
const allowedProjects = new Set(['demo-quadmart', 'quadmart-development']);
const hash = value => createHash('sha256').update(value).digest('hex');
function eligible(asset, mediaId, projectId, now) {
  if (!asset || !/^[a-f0-9]{64}$/.test(mediaId) || typeof asset.ownerUid !== 'string' || !asset.ownerUid) return 'invalid_registry';
  const expected = `quadmart/${projectId}/${hash(asset.ownerUid).slice(0,24)}/${mediaId}`;
  if (asset.publicId !== expected) return 'outside_scope';
  const created = asset.createdAt?.toMillis?.();
  if (!Number.isFinite(created) || created > now - MEDIA_GRACE_MS) return 'grace_period';
  if (asset.status === 'deleted') return 'already_deleted';
  if (!['pending', 'failed', 'ready', 'deleting'].includes(asset.status)) return 'protected_status';
  return null;
}
export async function cleanMedia(db, mediaId, { projectId, destroyImage, apply = false, now = Date.now() }) {
  if (!allowedProjects.has(projectId)) throw new Error('Cleanup is restricted to demo/development');
  if (typeof mediaId !== 'string' || !/^[a-f0-9]{64}$/.test(mediaId)) throw new Error('Invalid media identifier');
  const ref = db.doc(`media/${mediaId}`);
  const plan = await db.runTransaction(async tx => {
    const snap = await tx.get(ref), asset = snap.data();
    const hold = eligible(asset, mediaId, projectId, now);
    if (hold) return { outcome: hold };
    // Preserve active listings AND archived/report evidence, including resolved
    // reports. No evidence-retention policy is silently chosen by this cleaner.
    const refs = await Promise.all([
      tx.get(db.collection('listings').where('imageIds', 'array-contains', mediaId).limit(1)),
      tx.get(db.collection('removedListings').where('listing.imageIds', 'array-contains', mediaId).limit(1)),
      tx.get(db.collection('reports').where('snapshot.imageIds', 'array-contains', mediaId).limit(1)),
    ]);
    if (refs.some(s => !s.empty)) return { outcome: 'referenced' };
    if (apply) tx.update(ref, { status: 'deleting', cleanupStartedAt: FieldValue.serverTimestamp() });
    return { outcome: apply ? 'claimed' : 'would_delete', publicId: asset.publicId };
  });
  if (plan.outcome !== 'claimed') return { id: mediaId, outcome: plan.outcome };
  // Idempotent provider delete: a crash after deletion leaves a claim that a
  // later run can safely retry. Never mark complete on a provider failure.
  const result = await destroyImage(plan.publicId);
  if (!['ok', 'not found'].includes(result?.result)) throw new Error('Image deletion was not confirmed');
  await db.runTransaction(async tx => {
    const old = await tx.get(ref);
    if (old.data()?.status === 'deleted') return;
    if (old.data()?.status !== 'deleting' || old.data()?.publicId !== plan.publicId) throw new Error('Media cleanup claim changed');
    const a = old.data();
    tx.set(ref, { ownerUid: a.ownerUid, campusId: a.campusId, digest: a.digest ?? null, publicId: a.publicId, createdAt: a.createdAt, status: 'deleted', deletedAt: FieldValue.serverTimestamp() });
  });
  return { id: mediaId, outcome: 'deleted' };
}
export async function mediaCleanupPage(db, options = {}) {
  if (!allowedProjects.has(options.projectId)) throw new Error('Cleanup is restricted to demo/development');
  const { now = Date.now(), cursor } = options;
  let q = db.collection('media').where('createdAt', '<=', new Date(now - MEDIA_GRACE_MS)).orderBy('createdAt').orderBy(FieldPath.documentId()).limit(25);
  if (cursor) {
    if (!/^[a-f0-9]{64}$/.test(cursor)) throw new Error('Invalid cleanup cursor');
    const old = await db.doc(`media/${cursor}`).get();
    if (!old.exists || !old.data().createdAt) throw new Error('Cleanup cursor not found');
    q = q.startAfter(old.data().createdAt, cursor);
  }
  const page = await q.get(), results = [];
  for (const photo of page.docs) results.push(await cleanMedia(db, photo.id, { ...options, now }));
  return { results, nextCursor: page.size === 25 ? page.docs.at(-1).id : null };
}
