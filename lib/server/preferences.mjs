import { assertActive } from './safety.mjs';
import { MarketError } from './market-errors.mjs';
import { prepareQuota } from './limits.mjs';
import { MAX_SAVED_ITEMS, savedItemIds } from '../saved-items.mjs';
import { NOTIFICATION_WRITE_LIMIT } from '../notification-actions.mjs';

const fail = (message, status = 400) => { throw new MarketError(message, status); };
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
const fields = (data, allowed) => {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !allowed.includes(key))) fail('Invalid request');
};

export async function preferenceOperation(db, actor, campusId, action, data) {
  if (action === 'savedSet') {
    fields(data, ['listingId', 'saved']);
    if (!validId(data.listingId) || typeof data.saved !== 'boolean') fail('Invalid saved item');
  } else {
    fields(data, ['ids']);
    if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length > NOTIFICATION_WRITE_LIMIT || !data.ids.every(validId)) fail('Select between 1 and 30 notifications');
  }
  const uid = actor.uid, profileRef = db.doc(`users/${uid}`);
  return db.runTransaction(async tx => {
    await assertActive(db, tx, uid);
    const profile = await tx.get(profileRef);
    if (!profile.exists || profile.data().campusId !== campusId) fail('Finish account setup first', 403);
    if (action === 'savedSet') {
      const ids = savedItemIds(profile.data().savedListings);
      const exists = ids.includes(data.listingId);
      if (exists === data.saved) return { listingId: data.listingId, saved: data.saved };
      if (data.saved) {
        if (ids.length >= MAX_SAVED_ITEMS) fail('You can save up to 200 listings. Remove one to save another.', 409);
        const listing = await tx.get(db.doc(`listings/${data.listingId}`));
        if (!listing.exists || listing.data().campusId !== campusId || !['active', 'reserved', 'sold'].includes(listing.data().status)) fail('Listing is unavailable', 404);
      }
      const commit = await prepareQuota(db, tx, uid, 'savedSet');
      commit();
      tx.update(profileRef, { savedListings: data.saved ? [...ids, data.listingId] : ids.filter(id => id !== data.listingId) });
      return { listingId: data.listingId, saved: data.saved };
    }
    const ids = [...new Set(data.ids)];
    const snapshots = await Promise.all(ids.map(id => tx.get(db.doc(`notifications/${id}`))));
    // Validate the entire batch before writing anything, including unchanged rows.
    if (snapshots.some(snap => !snap.exists || snap.data().userId !== uid)) fail('Notifications unavailable', 403);
    const unread = snapshots.filter(snap => snap.data().read !== true);
    if (unread.length) {
      const commit = await prepareQuota(db, tx, uid, 'notificationsRead');
      commit();
      for (const snap of unread) tx.update(snap.ref, { read: true });
    }
    return { ids };
  });
}
