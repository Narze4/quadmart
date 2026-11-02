import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { MarketError } from './market-errors.mjs';
import { assertActive } from './safety.mjs';
import { prepareQuota } from './limits.mjs';
const fail = (message, status = 400) => { throw new MarketError(message, status); };
const key = (...values) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : fail('Invalid identifier');
function fields(data, allowed) {
  if (Object.keys(data).some(k => !allowed.includes(k))) fail('Unexpected listing field');
}
function listingInput(data) {
  fields(data, ['requestId', 'title', 'description', 'price', 'category', 'condition', 'imageIds']);
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 120) fail('Title must be between 1 and 120 characters');
  if (typeof data.description !== 'string' || data.description.length > 5000) fail('Description must be at most 5000 characters');
  if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0 || data.price > 100000) fail('Price must be between 0 and 100,000');
  if (!['Product', 'Service', 'Sublease'].includes(data.category)) fail('Invalid category');
  if (!['New', 'Like New', 'Good', 'Fair'].includes(data.condition)) fail('Invalid condition');
  const imageIds = data.imageIds;
  if (!Array.isArray(imageIds) || imageIds.length > 5 || new Set(imageIds).size !== imageIds.length || imageIds.some(i => typeof i !== 'string' || !/^[a-f0-9]{64}$/.test(i))) fail('Choose up to five different uploaded photos');
  return { title: data.title.trim(), description: data.description.trim(), price: data.price, category: data.category, condition: data.condition, imageIds };
}
export async function listingOperation(db, actor, campusId, action, data) {
  const uid = actor.uid;
  if (action === 'listingCreate') {
    const input = listingInput(data), requestId = identifier(data.requestId);
    const ref = db.doc(`listings/${key(uid, requestId)}`), ledger = db.doc(`listingRequests/${ref.id}`);
    const fingerprint = key(input);
    return db.runTransaction(async tx => {
      await assertActive(db, tx, uid);
      const [old, live, removed] = await Promise.all([tx.get(ledger), tx.get(ref), tx.get(db.doc(`removedListings/${ref.id}`))]);
      if (old.exists) {
        if (old.data().fingerprint !== fingerprint) fail('Request ID already used for a different listing', 409);
        if (!live.exists || removed.exists) fail('This listing is no longer available. Refresh before posting again.', 409);
        return { id: ref.id };
      }
      if (live.exists || removed.exists) fail('Listing already exists or was removed', 409);
      const photos = await Promise.all(input.imageIds.map(i => tx.get(db.doc(`media/${i}`))));
      if (photos.some((p, i) => !p.exists || p.data().status !== 'ready' || p.data().ownerUid !== uid || p.data().campusId !== campusId || p.data().url !== `/api/photos/${input.imageIds[i]}`)) fail('A photo is unavailable or does not belong to you', 400);
      const commitQuota = await prepareQuota(db, tx, uid, 'listingCreate');
      commitQuota();
      tx.create(ref, { ...input, images: input.imageIds.map(i => `/api/photos/${i}`), sellerUid: uid, sellerEmail: actor.email, campusId, status: 'active', version: 0, createdAt: FieldValue.serverTimestamp() });
      tx.create(ledger, { fingerprint, createdAt: FieldValue.serverTimestamp() });
      return { id: ref.id };
    });
  }
  fields(data, ['listingId', 'status', 'expectedVersion', 'requestId']);
  const ref = db.doc(`listings/${identifier(data.listingId)}`), requestId = key(uid, identifier(data.requestId));
  if (!['active', 'reserved'].includes(data.status)) fail('Invalid listing status');
  if (!Number.isSafeInteger(data.expectedVersion) || data.expectedVersion < 0) fail('Invalid listing version');
  return db.runTransaction(async tx => {
    await assertActive(db, tx, uid);
    const listing = await tx.get(ref), l = listing.data();
    if (!listing.exists || l.sellerUid !== uid || l.campusId !== campusId) fail('Listing not found', 403);
    if (!['active', 'reserved'].includes(l.status)) fail('This listing is no longer available', 409);
    const version = l.version ?? 0;
    if (l.lastStateRequest === requestId) {
      if (l.status !== data.status || version !== data.expectedVersion + 1) fail('Request ID already used', 409);
      return { id: ref.id, status: l.status, version };
    }
    if (version !== data.expectedVersion) fail('This listing changed. Refresh your listings and try again.', 409);
    if (l.status === data.status) return { id: ref.id, status: l.status, version };
    const commitQuota = await prepareQuota(db, tx, uid, 'listingState');
    commitQuota();
    tx.update(ref, { status: data.status, version: version + 1, lastStateRequest: requestId });
    return { id: ref.id, status: data.status, version: version + 1 };
  });
}
