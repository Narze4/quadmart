import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { reconcileAccountClosure, queueMissingAuthAccount } from '../server/account-closure.mjs';
import { mediaCleanupPage } from '../server/media-cleanup.mjs';
import { assertSource } from './backup.mjs';

const LEASE_MS = 15 * 60 * 1000;
const PAGE = 25;
const statePath = 'systemOperations/developmentMaintenance';
export async function runMaintenance({ db, auth, projectId, backup, destroyImage, apply = false, now = () => Date.now() }) {
  assertSource(projectId);
  if (db.projectId !== projectId) throw new Error('Maintenance database project mismatch');
  const ref = db.doc(statePath), owner = randomUUID();
  const summary = { version: 1, projectId, apply, status: 'running', failures: 0, manualReview: 0, staleJobs: 0, jobsVisited: 0, jobsCompleted: 0, jobsRemaining: 0, profilesChecked: 0, missingAuthQueued: 0, mediaVisited: 0, mediaDeleted: 0, mediaHeld: 0, overdueBeforeRun: false };
  let state = {}, acquired = false, stage = 'lease';
  try {
    if (apply) {
      acquired = await db.runTransaction(async tx => {
        state = (await tx.get(ref)).data() ?? {};
        if (state.leaseUntil > now()) return false;
        tx.set(ref, { leaseOwner: owner, leaseUntil: now() + LEASE_MS, lastStartedAt: now() }, { merge: true });
        return true;
      });
      if (!acquired) return { ...summary, status: 'already_running' };
    } else state = (await ref.get()).data() ?? {};
    summary.overdueBeforeRun = Boolean(state.lastSuccessAt && now() - state.lastSuccessAt > 18 * 60 * 60 * 1000);
    const guard = async () => {
      if (!apply) return;
      const current = (await ref.get()).data();
      if (current?.leaseOwner !== owner || current.leaseUntil <= now() + 30000) throw new Error('Maintenance lease expired or changed');
    };
    const checkpoint = async patch => {
      if (!apply) return;
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current?.leaseOwner !== owner || current.leaseUntil <= now()) throw new Error('Maintenance lease lost');
        tx.update(ref, patch);
      });
    };
    // Refuse destructive work unless a newly written encrypted backup has been
    // decrypted and verified successfully by the caller. Never reuse a stale file.
    stage = 'backup';
    const saved = await backup();
    if (!saved?.verified || !Number.isInteger(saved.documentCount)) throw new Error('Verified backup required');
    if (apply && projectId === 'quadmart-development' && !saved.offsiteVerified) throw new Error('Verified offsite backup required before development cleanup');
    summary.backupDocuments = saved.documentCount;
    summary.backupReadTime = saved.readTime;
    if (saved.fullRecovery) { summary.backupAccounts = saved.accountCount; summary.backupPhotos = saved.photoCount; summary.offsiteVerified = saved.offsiteVerified === true; }
    await guard();
    const page = async (collection, cursor) => {
      let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(PAGE);
      if (cursor) query = query.startAfter(cursor);
      return query.get();
    };
    stage = 'missing_auth';
    const profiles = await page('users', state.profileCursor);
    for (const row of profiles.docs) {
      await guard(); summary.profilesChecked++;
      try {
        const result = await queueMissingAuthAccount(db, auth, row.id, { apply });
        if (result.outcome === 'queued') summary.missingAuthQueued++;
        if (result.outcome === 'needs_manual_review') summary.manualReview++;
      } catch (error) {
        if (error.status === 409) summary.manualReview++; else summary.failures++;
      }
      await checkpoint({ profileCursor: row.id });
    }
    if (profiles.size < PAGE) await checkpoint({ profileCursor: null });
    stage = 'account_jobs';
    const jobs = await page('accountDeletions', state.accountCursor);
    for (const row of jobs.docs) {
      await guard(); summary.jobsVisited++;
      let phase = row.data().phase;
      if (phase !== 'complete') {
        if (now() - (row.data().requestedAt?.toMillis?.() ?? now()) > 24 * 60 * 60 * 1000) summary.staleJobs++;
        if (apply) {
          try {
            for (let batch = 0; batch < 20 && phase !== 'complete'; batch++) {
              await guard(); phase = (await reconcileAccountClosure(db, auth, row.id)).phase;
            }
          } catch { summary.failures++; }
        }
        if (phase === 'complete') summary.jobsCompleted++; else summary.jobsRemaining++;
      }
      await checkpoint({ accountCursor: row.id });
    }
    if (jobs.size < PAGE) await checkpoint({ accountCursor: null });
    stage = 'media'; await guard();
    // A failed page is retried from its old checkpoint; per-asset deletion is
    // idempotent. Guard before every provider call, including a long page.
    const photos = await mediaCleanupPage(db, { projectId, apply, cursor: state.mediaCursor, now: now(), destroyImage: async id => { await guard(); return destroyImage(id); } });
    summary.mediaVisited = photos.results.length;
    summary.mediaDeleted = photos.results.filter(r => r.outcome === 'deleted').length;
    summary.mediaHeld = photos.results.filter(r => !['deleted', 'already_deleted'].includes(r.outcome)).length;
    await checkpoint({ mediaCursor: photos.nextCursor });
    summary.status = summary.failures || summary.manualReview ? 'attention' : 'success';
    await checkpoint({ lastBackupAt: now(), lastFinishedAt: now(), lastSummary: summary, ...(summary.status === 'success' ? { lastSuccessAt: now() } : {}) });
    return summary;
  } catch {
    summary.status = 'failed'; summary.failures++; summary.failedStage = stage;
    if (acquired) {
      try { await db.runTransaction(async tx => { const s = (await tx.get(ref)).data(); if (s?.leaseOwner === owner) tx.update(ref, { lastFinishedAt: now(), lastSummary: summary }); }); } catch { /* Local report still records failure. */ }
    }
    return summary;
  } finally {
    if (acquired) await db.runTransaction(async tx => { const s = (await tx.get(ref)).data(); if (s?.leaseOwner === owner) tx.update(ref, { leaseUntil: 0, leaseOwner: null }); });
  }
}
