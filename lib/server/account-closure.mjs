import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import { getUniversityFromEmail } from '../universities.js';
import { MarketError } from './market-errors.mjs';

const fail = (message, status = 400) => { throw new MarketError(message, status); };
const stamp = () => FieldValue.serverTimestamp();
const BATCH = 25;
const stages = ['listings', 'notifications', 'blocks', 'conversations', 'profile', 'auth', 'complete'];
const publicFields = ['uid', 'campusId', 'university', 'transactions', 'sellerScore', 'buyerScore', 'sellerReviewCount', 'sellerRatingSum', 'buyerReviewCount', 'buyerRatingSum'];
export function closedProfile(profile, uid, campusId) {
  return { ...Object.fromEntries(publicFields.filter(k => profile[k] !== undefined).map(k => [k, profile[k]])), uid, campusId, displayName: 'Deleted student', closed: true };
}
function recentLogin(actor, now) {
  if (!Number.isFinite(actor.auth_time) || now / 1000 - actor.auth_time > 300 || actor.auth_time > now / 1000 + 30) fail('Sign in again to confirm account deletion.', 401);
}
const projection = job => ({ phase: job.phase, readyForAuthDeletion: job.phase === 'auth' || job.phase === 'complete' });
export async function accountClosure(db, actor, campusId, action, data, now = Date.now()) {
  if (Object.keys(data).some(k => k !== 'confirmation')) fail('Unexpected deletion field.');
  const uid = actor.uid, ref = db.doc(`accountDeletions/${uid}`), lifecycle = db.doc(`accountLifecycle/${uid}`);
  if (action === 'accountCloseStatus') {
    const old = await ref.get();
    return old.exists ? projection(old.data()) : { phase: 'none', readyForAuthDeletion: false };
  }
  recentLogin(actor, now);
  if (action === 'accountCloseStep') return advanceAccountClosure(db, uid);
  if (action !== 'accountClose' || data.confirmation !== 'DELETE') fail('Confirm account deletion.');
  return db.runTransaction(async tx => {
    const [job, role, profile] = await Promise.all([tx.get(ref), tx.get(db.doc(`moderators/${uid}`)), tx.get(db.doc(`publicProfiles/${uid}`))]);
    if (job.exists) return projection(job.data());
    if (role.data()?.active) fail('Transfer moderator responsibilities before deleting this account. Contact support.', 409);
    if (profile.exists && profile.data().campusId !== campusId) fail('Account membership changed. Contact support.', 403);
    tx.create(ref, { phase: 'listings', requestedAt: stamp(), updatedAt: stamp() });
    tx.set(lifecycle, { closed: true, requestedAt: stamp() });
    tx.set(profile.ref, closedProfile(profile.data() ?? {}, uid, campusId));
    return { phase: 'listings', readyForAuthDeletion: false };
  });
}

// Every database batch and its checkpoint commit together. The signed-in account
// can resume only its own job; the operator worker uses this same function.
export async function advanceAccountClosure(db, uid) {
  return db.runTransaction(async tx => {
    const jobRef = db.doc(`accountDeletions/${uid}`);
    const [job, lifecycle] = await Promise.all([tx.get(jobRef), tx.get(db.doc(`accountLifecycle/${uid}`))]);
    if (!job.exists || lifecycle.data()?.closed !== true) fail('No account deletion has been requested.', 409);
    const { phase, cursor } = job.data();
    if (!stages.includes(phase)) throw new Error('Invalid deletion checkpoint');
    if (phase === 'auth' || phase === 'complete') return projection(job.data());
    let query;
    if (phase === 'listings') query = db.collection('listings').where('sellerUid', '==', uid).limit(BATCH);
    if (phase === 'notifications') query = db.collection('notifications').where('userId', '==', uid).limit(BATCH);
    if (phase === 'blocks') query = db.collection(`users/${uid}/blocks`).limit(BATCH);
    if (phase === 'conversations') {
      query = db.collection('conversations').where('participants', 'array-contains', uid).orderBy(FieldPath.documentId()).limit(BATCH);
      if (cursor) query = query.startAfter(cursor);
    }
    let next = stages[stages.indexOf(phase) + 1], nextCursor = null;
    if (query) {
      const rows = await tx.get(query);
      if (phase === 'conversations') {
        for (const row of rows.docs) {
          const c = row.data();
          tx.update(row.ref, { participantNames: c.participants.map((person, index) => person === uid ? 'Deleted student' : (c.participantNames?.[index] ?? 'Student')), closedParticipants: FieldValue.arrayUnion(uid) });
        }
        if (rows.size === BATCH) { next = phase; nextCursor = rows.docs.at(-1).id; }
      } else {
        for (const row of rows.docs) tx.delete(row.ref);
        if (rows.size === BATCH) next = phase;
      }
    } else if (phase === 'profile') {
      tx.delete(db.doc(`users/${uid}`));
      tx.delete(db.doc(`moderators/${uid}`));
    }
    tx.update(jobRef, { phase: next, cursor: nextCursor, updatedAt: stamp() });
    return projection({ phase: next });
  });
}

// Privileged maintenance can finish an interrupted browser flow. No Auth admin
// role is added to the web app: normal clients delete their own recent login.
export async function reconcileAccountClosure(db, auth, uid) {
  const state = await advanceAccountClosure(db, uid);
  if (!state.readyForAuthDeletion) return state;
  if (state.phase === 'complete') return state;
  try { await auth.deleteUser(uid); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  await db.doc(`accountDeletions/${uid}`).update({ phase: 'complete', completedAt: stamp(), updatedAt: stamp() });
  return { phase: 'complete', readyForAuthDeletion: true };
}

// Reconcile a login deleted outside QuadMart's UI. A missing Auth record must be
// positively confirmed; a network/permission error is never treated as absence.
export async function queueMissingAuthAccount(db, auth, uid, { apply = false } = {}) {
  try { await auth.getUser(uid); return { outcome: 'login_exists' }; }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  const profile = await db.doc(`users/${uid}`).get();
  const campus = getUniversityFromEmail(profile.data()?.email)?.domain;
  if (!profile.exists || !campus || profile.data().campusId !== campus) return { outcome: 'needs_manual_review' };
  if (!apply) return { outcome: 'would_queue' };
  await accountClosure(db, { uid, email: profile.data().email, auth_time: Date.now() / 1000 }, campus, 'accountClose', { confirmation: 'DELETE' });
  return { outcome: 'queued' };
}
