import fs from 'node:fs/promises';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { recentListingsFeed, marketplaceFeed, sellerListingsFeed, savedListingsFeed, listingBuyersFeed } from '../lib/feed-queries.mjs';
import { savedItemIds, writeSavedItem } from '../lib/saved-items.mjs';
let env, db;
const id = n => `owned-${String(n).padStart(3, '0')}`;
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated emulator required');
  env = await initializeTestEnvironment({ projectId: 'demo-quadmart', firestore: { rules: await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  await env.clearFirestore(); db = env.authenticatedContext('owner', { email: 'owner@emory.edu', email_verified: true }).firestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const admin = ctx.firestore(), batch = writeBatch(admin), createdAt = Timestamp.fromMillis(1793200000000);
    batch.set(doc(admin, 'users/owner'), { uid: 'owner', campusId: 'emory.edu', displayName: 'Owner', savedListings: [] });
    for (let i = 0; i < 90; i++) batch.set(doc(admin, 'listings', id(i)), { sellerUid: 'owner', campusId: 'emory.edu', status: ['active', 'reserved', 'sold'][i % 3], title: `Owned ${i}`, createdAt });
    for (let i = 0; i < 133; i++) batch.set(doc(admin, `listings/${String(i).padStart(4, '0')}`), { sellerUid: 'other', campusId: 'emory.edu', status: 'active', category: 'Product', price: i, title: i === 0 ? 'Rare oldest bicycle' : `Campus ${i}`, createdAt });
    batch.set(doc(admin, 'listings/foreign'), { sellerUid: 'owner', campusId: 'uga.edu', status: 'active', title: 'Private foreign title', createdAt });
    for (let i = 0; i < 65; i++) {
      batch.set(doc(admin, `conversations/c${String(i).padStart(3, '0')}`), { listingId: id(0), participants: ['owner', `buyer${i}`] });
      batch.set(doc(admin, `publicProfiles/buyer${i}`), { campusId: i === 64 ? 'uga.edu' : 'emory.edu', displayName: `Buyer ${i}` });
    }
    await batch.commit();
  });
});
after(async () => await env?.cleanup());
async function allPages(feed) {
  let cursor = null, page, items = [];
  do { page = await feed.loadPage(cursor); items.push(...page.items); assert.notEqual(page.cursor, cursor); cursor = page.cursor; } while (page.hasMore);
  return items;
}
test('dashboard loads eight recent campus listings and searches beyond its initial preview', async () => {
  const recent = await recentListingsFeed(db, 'emory.edu').loadPage(null); assert.equal(recent.items.length, 8); assert(recent.hasMore); assert(recent.items.every(x => x.status === 'active' && x.campusId === 'emory.edu'));
  const search = { loadPage: marketplaceFeed(db, 'emory.edu', { category: 'All', search: 'oldest bicycle', sort: 'newest', condition: '', minPrice: '', maxPrice: '' }) };
  const first = await search.loadPage(null); assert.equal(first.items.length, 0); assert(first.hasMore);
  const items = await allPages(search); assert.deepEqual(items.map(x => x.id), ['0000']);
});
test('each seller status paginates all owned rows with tied dates and excludes other campuses/sellers', async () => {
  for (const status of ['active', 'reserved', 'sold']) {
    const items = await allPages(sellerListingsFeed(db, 'owner', 'emory.edu', status)); assert.equal(items.length, 30); assert.equal(new Set(items.map(x => x.id)).size, 30); assert(items.every(x => x.sellerUid === 'owner' && x.status === status));
  }
  await assertFails(sellerListingsFeed(db, 'owner', 'uga.edu', 'active').loadPage(null));
  assert.throws(() => sellerListingsFeed(db, 'owner', 'emory.edu', 'invalid'));
});
test('saved pages preserve newest-save order and unavailable slots across all pages', async () => {
  const ids = [...Array.from({ length: 60 }, (_, i) => id(i)), 'missing', 'foreign'];
  const first = await savedListingsFeed(db, 'owner', 'emory.edu', ids).loadPage(null); assert.equal(first.items.length, 24); assert.equal(first.cursor, 24); assert(first.hasMore);
  assert.deepEqual(first.items.slice(0, 2), [{ id: 'foreign', unavailable: true }, { id: 'missing', unavailable: true }]);
  const all = await allPages(savedListingsFeed(db, 'owner', 'emory.edu', ids)); assert.deepEqual(all.map(x => x.id), [...ids].reverse()); assert.equal(all.filter(x => x.unavailable).length, 2); assert(all.some(x => x.status === 'sold'));
  assert.deepEqual((await savedListingsFeed(db, 'owner', 'emory.edu', []).loadPage(null)).items, []);
});
test('saved writes are idempotent, owned, capped and reject malformed identifiers', async () => {
  await Promise.all([writeSavedItem(db, 'owner', id(0), true), writeSavedItem(db, 'owner', id(0), true)]);
  assert.deepEqual((await getDoc(doc(db, 'users/owner'))).data().savedListings, [id(0)]);
  await writeSavedItem(db, 'owner', id(0), false); assert.deepEqual((await getDoc(doc(db, 'users/owner'))).data().savedListings, []);
  const other = env.authenticatedContext('other', { email: 'other@emory.edu', email_verified: true }).firestore();
  await assertFails(writeSavedItem(other, 'owner', id(0), true)); await assertFails(getDoc(doc(other, 'users/owner')));
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/owner'), { savedListings: Array.from({ length: 200 }, (_, i) => `saved-${i}`) }, { merge: true }));
  await assertFails(writeSavedItem(db, 'owner', 'overflow', true));
  assert.throws(() => savedItemIds(['path/escape'])); assert.throws(() => savedItemIds('not-an-array')); assert.throws(() => savedItemIds(Array(201).fill('x'))); assert.deepEqual(savedItemIds(['a', 'a', 'b']), ['a', 'b']);
});
test('buyer choices paginate with participant authorization and skip foreign profiles', async () => {
  const items = await allPages(listingBuyersFeed(db, id(0), 'owner')); assert.equal(items.length, 64); assert.equal(new Set(items.map(x => x.uid)).size, 64); assert(!items.some(x => x.uid === 'buyer64'));
  const other = env.authenticatedContext('other', { email: 'other@emory.edu', email_verified: true }).firestore();
  await assertFails(listingBuyersFeed(other, id(0), 'owner').loadPage(null));
});
test('unverified accounts cannot read any new collection feed or write saves', async () => {
  const unverified = env.authenticatedContext('owner', { email: 'owner@emory.edu', email_verified: false }).firestore();
  await assertFails(recentListingsFeed(unverified, 'emory.edu').loadPage(null)); await assertFails(sellerListingsFeed(unverified, 'owner', 'emory.edu', 'sold').loadPage(null)); await assertFails(savedListingsFeed(unverified, 'owner', 'emory.edu', [id(0)]).loadPage(null)); await assertFails(writeSavedItem(unverified, 'owner', id(0), false));
});
