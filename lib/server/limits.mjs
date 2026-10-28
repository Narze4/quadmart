import { createHash } from 'node:crypto';

// Fixed UTC minute/day windows. One persistent document per account/bucket,
// shared by every server instance; retries of a completed mutation skip its quota.
export const LIMITS = Object.freeze({
  api: { minute: 120, day: 2000 },
  listingCreate: { minute: 6, day: 20 },
  listingState: { minute: 30, day: 300 },
  conversation: { minute: 10, day: 50 },
  message: { minute: 30, day: 500 },
  profile: { minute: 10, day: 50 },
});
export class RateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super(`Too many requests. Try again in ${retryAfterSeconds} seconds.`);
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export const limitId = (uid, bucket) => createHash('sha256').update(JSON.stringify([uid, bucket])).digest('hex');
export async function prepareQuota(db, tx, uid, bucket, now = Date.now()) {
  const cap = LIMITS[bucket];
  if (!cap) throw new Error('Unknown quota');
  const ref = db.doc(`operationLimits/${limitId(uid, bucket)}`);
  const old = (await tx.get(ref)).data() ?? {};
  const minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
  const minuteCount = old.minute === minute ? old.minuteCount : 0;
  const dayCount = old.day === day ? old.dayCount : 0;
  const retryAfter = Math.max(
    minuteCount >= cap.minute ? (minute + 1) * 60000 - now : 0,
    dayCount >= cap.day ? (day + 1) * 86400000 - now : 0,
  );
  if (retryAfter > 0) throw new RateLimitError(Math.max(1, Math.ceil(retryAfter / 1000)));
  // Call only after ALL transaction reads. A failed business operation must not
  // leave a debited operation quota or a partially written business document.
  return () => tx.set(ref, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
}
export const consumeQuota = (db, uid, bucket, now) => db.runTransaction(async tx => {
  const commit = await prepareQuota(db, tx, uid, bucket, now);
  commit();
});
