import { createHash } from 'node:crypto';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';

export class SafetyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status = 400) => { throw new SafetyError(message, status); };
const stamp = () => FieldValue.serverTimestamp();
const key = (...values) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : fail('Invalid identifier.');
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : fail(`Enter between ${min} and ${max} characters.`);
const get = (reader, ref) => typeof reader.get === 'function' ? reader.get(ref) : ref.get();
export const accountRef = (db, uid) => db.doc(`moderationAccounts/${uid}`);
const blockRef = (db, from, to) => db.doc(`users/${from}/blocks/${to}`);

export async function assertActive(db, reader, ...uids) {
  const states = await Promise.all([...new Set(uids)].map(uid => get(reader, accountRef(db, uid))));
  if (states.some(state => state.data()?.suspended === true)) fail('This account is suspended. Contact support for a review.', 403);
}
export async function assertCanContact(db, reader, a, b) {
  await assertActive(db, reader, a, b);
  const blocks = await Promise.all([get(reader, blockRef(db, a, b)), get(reader, blockRef(db, b, a))]);
  if (blocks.some(block => block.exists)) fail('Messaging and new trades are unavailable between these accounts.', 403);
}
export async function moderator(db, reader, uid, campusId) {
  const role = await get(reader, db.doc(`moderators/${uid}`));
  return role.data()?.active === true && Array.isArray(role.data()?.campusIds) && role.data().campusIds.includes(campusId);
}
const serialize = snap => {
  const data = snap.data();
  return { id: snap.id, ...data, createdAt: data.createdAt?.toDate().toISOString() ?? null, updatedAt: data.updatedAt?.toDate().toISOString() ?? null };
};

export async function safetyOperation(db, actor, campusId, action, data) {
  const uid = actor.uid;
  if (action === 'safetyStatus') return { isModerator: await moderator(db, db, uid, campusId) };
  if (action === 'safetyOverview') {
    const [blocks, reports] = await Promise.all([
      db.collection(`users/${uid}/blocks`).limit(200).get(),
      db.collection('reports').where('reporterUid', '==', uid).orderBy('createdAt', 'desc').limit(50).get(),
    ]);
    return {
      blocks: blocks.docs.map(serialize),
      reports: reports.docs.map(s => ({ id: s.id, targetType: s.data().targetType, targetLabel: s.data().targetLabel, status: s.data().status, resolution: s.data().resolution ?? null, createdAt: s.data().createdAt.toDate().toISOString() })),
    };
  }
  if (action === 'blockStatus') {
    const targetUid = id(data.targetUid);
    const [own, other] = await Promise.all([blockRef(db, uid, targetUid).get(), blockRef(db, targetUid, uid).get()]);
    return { blockedByYou: own.exists, contactUnavailable: own.exists || other.exists };
  }
  if (action === 'block') {
    const targetUid = id(data.targetUid);
    if (targetUid === uid) fail('You cannot block yourself.');
    if (typeof data.blocked !== 'boolean') fail('Invalid block state.');
    return db.runTransaction(async tx => {
      await assertActive(db, tx, uid);
      const target = await tx.get(db.doc(`publicProfiles/${targetUid}`));
      const existing = await tx.get(blockRef(db, uid, targetUid));
      if (!target.exists || target.data().campusId !== campusId) fail('Account not found.', 404);
      // A bounded list keeps the safety page usable and caps per-account storage.
      if (data.blocked && !existing.exists) {
        const blocks = await tx.get(db.collection(`users/${uid}/blocks`).limit(200));
        if (blocks.size >= 200) fail('Your block list is full. Contact support.', 409);
        tx.create(blockRef(db, uid, targetUid), { targetUid, displayName: target.data().displayName, createdAt: stamp() });
      } else if (!data.blocked) tx.delete(blockRef(db, uid, targetUid));
      return { blocked: data.blocked };
    });
  }
  if (action === 'report') {
    const targetType = data.targetType;
    if (!['listing', 'user'].includes(targetType)) fail('Choose a listing or account to report.');
    const targetId = id(data.targetId), requestId = id(data.requestId);
    if (!['scam', 'harassment', 'inappropriate', 'prohibited', 'spam', 'other'].includes(data.reason)) fail('Choose a report reason.');
    const details = text(data.details, 10, 2000);
    const conversationId = data.conversationId ? id(data.conversationId) : null;
    const ref = db.doc(`reports/${key(uid, requestId)}`), openRef = db.doc(`openReports/${key(uid, targetType, targetId)}`);
    const fingerprint = key(targetType, targetId, data.reason, details, conversationId);
    return db.runTransaction(async tx => {
      await assertActive(db, tx, uid);
      const [old, open, target, budget] = await Promise.all([
        tx.get(ref), tx.get(openRef), tx.get(db.doc(`${targetType === 'listing' ? 'listings' : 'publicProfiles'}/${targetId}`)), tx.get(db.doc(`reportLimits/${uid}`)),
      ]);
      if (old.exists) { if (old.data().fingerprint !== fingerprint) fail('Request ID already used.', 409); return { id: ref.id }; }
      if (open.exists) return { id: open.data().reportId, alreadyOpen: true };
      if (!target.exists || target.data().campusId !== campusId) fail('Report target not found.', 404);
      const targetUid = targetType === 'listing' ? target.data().sellerUid : targetId;
      if (targetUid === uid) fail('You cannot report your own account or listing.');
      let evidence = [];
      if (conversationId) {
        const conversation = await tx.get(db.doc(`conversations/${conversationId}`));
        if (!conversation.exists || conversation.data().campusId !== campusId || !conversation.data().participants.includes(uid) || !conversation.data().participants.includes(targetUid)) fail('Conversation not available for this report.', 403);
        const messages = await tx.get(db.collection(`conversations/${conversationId}/messages`).orderBy('createdAt', 'desc').limit(10));
        evidence = messages.docs.reverse().map(m => ({ id: m.id, senderUid: m.data().senderUid, text: m.data().text, createdAt: m.data().createdAt }));
      }
      const day = Math.floor(Date.now() / 86400000), count = budget.data()?.day === day ? budget.data().count : 0;
      if (count >= 5) fail('Daily report limit reached. Contact support if you need further help.', 429);
      const targetLabel = targetType === 'listing' ? target.data().title : target.data().displayName;
      tx.create(ref, { reporterUid: uid, targetType, targetId, targetUid, targetLabel, campusId, reason: data.reason, details, conversationId, evidence, fingerprint, status: 'open', createdAt: stamp(), snapshot: targetType === 'listing' ? { title: target.data().title, description: target.data().description, price: target.data().price, imageIds: target.data().imageIds ?? [] } : { displayName: targetLabel } });
      tx.set(openRef, { reportId: ref.id });
      tx.set(db.doc(`reportLimits/${uid}`), { day, count: count + 1 });
      return { id: ref.id };
    });
  }
  if (action === 'moderationQueue') {
    if (!await moderator(db, db, uid, campusId)) fail('Moderator access required.', 403);
    const status = data.status ?? 'open';
    if (!['open', 'resolved'].includes(status)) fail('Invalid report status.');
    let q = db.collection('reports').where('campusId', '==', campusId).where('status', '==', status).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(25);
    if (data.cursor) {
      const cursor = await db.doc(`reports/${id(data.cursor)}`).get();
      if (!cursor.exists || cursor.data().campusId !== campusId || cursor.data().status !== status) fail('Invalid page cursor.');
      q = q.startAfter(cursor);
    }
    const reports = await q.get();
    return { reports: reports.docs.map(serialize), nextCursor: reports.size === 25 ? reports.docs.at(-1).id : null };
  }
  if (action === 'moderate') {
    const reportId = id(data.reportId), decision = data.decision, note = text(data.note, 10, 1000);
    if (!['dismiss', 'removeListing', 'suspend', 'restoreListing', 'reinstate'].includes(decision)) fail('Invalid moderation decision.');
    const reportRef = db.doc(`reports/${reportId}`);
    return db.runTransaction(async tx => {
      await assertActive(db, tx, uid);
      if (!await moderator(db, tx, uid, campusId)) fail('Moderator access required.', 403);
      const report = await tx.get(reportRef);
      if (!report.exists || report.data().campusId !== campusId) fail('Report not found.', 404);
      const r = report.data();
      const openRef = db.doc(`openReports/${key(r.reporterUid, r.targetType, r.targetId)}`);
      const open = await tx.get(openRef);
      // Optimistic version prevents one moderator's stale screen undoing another.
      const version = r.version ?? 0;
      if (data.version !== version) fail('This report changed. Refresh before deciding.', 409);
      if (['dismiss', 'removeListing', 'suspend'].includes(decision) && r.status !== 'open') fail('Report already resolved.', 409);
      if (decision === 'restoreListing' && r.resolution !== 'removeListing') fail('This report did not remove a listing.', 409);
      if (decision === 'reinstate' && r.resolution !== 'suspend') fail('This report did not suspend an account.', 409);
      if (r.targetUid === uid) fail('You cannot moderate your own account or listing.', 403);
      const targetRole = await tx.get(db.doc(`moderators/${r.targetUid}`));
      if (decision === 'suspend' && targetRole.data()?.active) fail('Moderator accounts require owner review.', 403);
      if (decision === 'removeListing' || decision === 'restoreListing') {
        if (r.targetType !== 'listing') fail('This report is not about a listing.');
        const liveRef = db.doc(`listings/${r.targetId}`), archiveRef = db.doc(`removedListings/${r.targetId}`);
        const [live, archive] = await Promise.all([tx.get(liveRef), tx.get(archiveRef)]);
        const restoring = decision === 'restoreListing';
        const source = restoring ? archive.data()?.listing : live.data();
        if (!source || source.sellerUid !== r.targetUid || source.campusId !== campusId) fail('Listing unavailable.', 409);
        if (restoring && (live.exists || archive.data().reportId !== reportId)) fail('Listing was changed by another decision.', 409);
        const photos = await Promise.all((source.imageIds ?? []).map(photoId => tx.get(db.doc(`media/${id(photoId)}`))));
        for (const photo of photos) {
          if (!photo.exists) continue;
          const removals = photo.data().removedByReports ?? [];
          if (restoring) {
            const remaining = removals.filter(value => value !== reportId);
            tx.update(photo.ref, { status: remaining.length ? 'blocked' : 'ready', removedByReports: remaining });
          } else tx.update(photo.ref, { status: 'blocked', removedByReports: [...new Set([...removals, reportId])] });
        }
        if (restoring) { tx.create(liveRef, source); tx.delete(archiveRef); }
        else { tx.create(archiveRef, { listing: source, reportId, removedAt: stamp(), removedBy: uid }); tx.delete(liveRef); }
      }
      if (decision === 'suspend' || decision === 'reinstate') {
        const stateRef = accountRef(db, r.targetUid), state = await tx.get(stateRef);
        if (decision === 'reinstate' && state.data()?.reportId !== reportId) fail('Account has a different suspension. Review that report.', 409);
        tx.set(stateRef, { suspended: decision === 'suspend', reportId, updatedAt: stamp() });
      }
      if (open.data()?.reportId === reportId) tx.delete(openRef);
      tx.update(reportRef, { status: 'resolved', resolution: decision, version: version + 1, moderatorUid: uid, note, updatedAt: stamp() });
      tx.create(db.collection('moderationEvents').doc(), { reportId, actorUid: uid, targetUid: r.targetUid, decision, note, version: version + 1, createdAt: stamp() });
      return { id: reportId, resolution: decision };
    });
  }
  fail('Unknown safety operation.');
}
