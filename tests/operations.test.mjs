import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { runMaintenance } from '../lib/operations/worker.mjs';
import { accountClosure } from '../lib/server/account-closure.mjs';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw Error('Both local emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'operations-test'), db = getFirestore(app), auth = getAuth(app);
const backup = async () => ({ verified: true, documentCount: 1, readTime: new Date().toISOString() });
const run = extra => runMaintenance({ db, auth, projectId: 'demo-quadmart', backup, destroyImage: async () => ({ result: 'ok' }), apply: true, ...extra });
const stateRef = () => db.doc('systemOperations/developmentMaintenance');
beforeEach(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts', { method: 'DELETE' });
});
after(async () => { await db.terminate(); await deleteApp(app); });
async function seed(uid) {
  await auth.createUser({ uid, email: `${uid}@emory.edu`, password: 'Synthetic-test-only-123' });
  await db.doc(`users/${uid}`).set({ uid, email: `${uid}@emory.edu`, campusId: 'emory.edu' });
  await db.doc(`publicProfiles/${uid}`).set({ uid, displayName: uid, campusId: 'emory.edu' });
}
test('backup failure blocks cleanup and leaves a failure report while releasing the lease', async () => {
  await seed('student'); await auth.deleteUser('student');
  const result = await run({ backup: async () => { throw Error('storage unavailable'); } });
  assert.equal(result.status, 'failed'); assert.equal(result.failedStage, 'backup');
  assert((await db.doc('users/student').get()).exists); assert(!(await db.doc('accountLifecycle/student').get()).exists);
  const state = (await stateRef().get()).data(); assert.equal(state.leaseUntil, 0); assert.equal(state.lastSummary.status, 'failed');
});
test('one active lease prevents overlapping work and an expired lease can recover', async () => {
  let release; const held = new Promise(resolve => { release = resolve; }); let started;
  const ready = new Promise(resolve => { started = resolve; });
  const first = run({ backup: async () => { started(); await held; return backup(); } }); await ready;
  assert.equal((await run()).status, 'already_running'); release(); assert.equal((await first).status, 'success');
  await stateRef().set({ leaseOwner: 'crashed', leaseUntil: Date.now() - 1 }, { merge: true }); assert.equal((await run()).status, 'success');
});
test('missing Auth is reconciled but live accounts and moderator responsibilities are protected', async () => {
  for (const uid of ['missing', 'live', 'moderator']) await seed(uid);
  await auth.deleteUser('missing'); await auth.deleteUser('moderator');
  await db.doc('moderators/moderator').set({ active: true, campusIds: ['emory.edu'] });
  const result = await run();
  assert.equal(result.missingAuthQueued, 1); assert.equal(result.jobsCompleted, 1); assert.equal(result.manualReview, 1); assert.equal(result.status, 'attention');
  assert(!(await db.doc('users/missing').get()).exists); assert((await db.doc('users/live').get()).exists); assert((await db.doc('users/moderator').get()).exists);
});
test('dry-run does not write cursors, queue closures or delete logins', async () => {
  await seed('student'); await auth.deleteUser('student');
  const result = await run({ apply: false }); assert.equal(result.status, 'success');
  assert(!(await stateRef().get()).exists); assert(!(await db.doc('accountDeletions/student').get()).exists); assert((await db.doc('users/student').get()).exists);
});
test('bounded profile and job cursors wrap without starving later records', async () => {
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`accountDeletions/${String(i).padStart(2, '0')}`), { phase: 'complete' });
  await batch.commit();
  assert.equal((await run()).jobsVisited, 25); assert.equal((await run()).jobsVisited, 5);
  assert.equal((await stateRef().get()).data().accountCursor, null); assert.equal((await run()).jobsVisited, 25);
});
test('stale jobs, failed Auth calls and overdue runs are visible without private data', async () => {
  await seed('student');
  await accountClosure(db, { uid: 'student', auth_time: Date.now()/1000 }, 'emory.edu', 'accountClose', { confirmation: 'DELETE' });
  await db.doc('accountDeletions/student').update({ requestedAt: new Date(Date.now() - 48*3600000) });
  await stateRef().set({ lastSuccessAt: Date.now() - 20*3600000 });
  const result = await run({ auth: { getUser: async () => ({ uid: 'student' }), deleteUser: async () => { throw Error('private@example.edu credential'); } } });
  assert.equal(result.status, 'attention'); assert.equal(result.staleJobs, 1); assert.equal(result.jobsRemaining, 1); assert(result.overdueBeforeRun); assert(!JSON.stringify(result).includes('private@example.edu'));
});
test('lost or expired lease stops before destructive cleanup', async () => {
  await seed('student'); await auth.deleteUser('student');
  const result = await run({ backup: async () => { await stateRef().update({ leaseOwner: 'replacement' }); return backup(); } });
  assert.equal(result.status, 'failed'); assert(!(await db.doc('accountLifecycle/student').get()).exists); assert.equal((await stateRef().get()).data().leaseOwner, 'replacement');
});
test('project mismatch is rejected before any cloud work', async () => {
  await assert.rejects(run({ projectId: 'quadmart-4410f' })); await assert.rejects(run({ projectId: 'quadmart-development' }));
});
