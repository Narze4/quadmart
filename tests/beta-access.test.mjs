import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { operate } from '../lib/server/market.mjs';
import { createMarketHandler } from '../lib/server/market-handler.mjs';
import { uploadPhoto, authorizePhoto } from '../lib/server/uploads.mjs';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated Firestore emulator required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'beta-access-tests'), db = getFirestore(app);
const seller = { uid: 'beta-seller', email: 'beta-seller@emory.edu', email_verified: true };
const buyer = { uid: 'beta-buyer', email: 'beta-buyer@emory.edu', email_verified: true };
const policy = { mode: 'invite-only', campusId: 'emory.edu' };
const invite = actor => db.doc(`betaAccess/${actor.uid}`).set({ active: true, campusId: 'emory.edu' });
const api = (actor, action, data = {}) => operate(db, actor, action, data);
const denied = error => error.status === 403;
const listing = () => ({ title: 'Synthetic beta desk', description: 'Local beta acceptance fixture', price: 20, category: 'Product', condition: 'Good', imageIds: [], requestId: crypto.randomUUID() });
beforeEach(async () => {
  const cleared = await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
  assert(cleared.ok);
  await db.doc('betaSettings/access').set(policy);
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('uninvited verified account cannot provision a profile or publish', async () => {
  await assert.rejects(api(seller, 'profile'), denied);
  await assert.rejects(api(seller, 'listingCreate', listing()), denied);
  assert.equal((await db.collection('users').get()).size, 0);
  assert.equal((await db.collection('listings').get()).size, 0);
});
test('invited seller and buyer complete a trade and both reviews', async () => {
  for (const actor of [seller, buyer]) { await invite(actor); await api(actor, 'profile', { displayName: actor.uid }); }
  const { id } = await api(seller, 'listingCreate', listing());
  const chat = await api(buyer, 'conversation', { listingId: id });
  await api(buyer, 'message', { conversationId: chat.id, text: 'Synthetic beta message', requestId: 'beta-message' });
  await api(buyer, 'savedSet', { listingId: id, saved: true });
  await api(seller, 'sale', { listingId: id, buyerUid: buyer.uid });
  for (const actor of [seller, buyer]) await api(actor, 'review', { transactionId: id, rating: 5, comment: 'Local test review' });
  const sale = (await db.doc(`transactions/${id}`).get()).data();
  assert.equal(sale.buyerReviewed, true); assert.equal(sale.sellerReviewed, true);
  assert.equal((await db.doc(`publicProfiles/${seller.uid}`).get()).data().transactions, 1);
});
test('revocation blocks both actor actions and contact/trades with that counterparty', async () => {
  for (const actor of [seller, buyer]) { await invite(actor); await api(actor, 'profile'); }
  const { id } = await api(seller, 'listingCreate', listing());
  const chat = await api(buyer, 'conversation', { listingId: id });
  await db.doc(`betaAccess/${buyer.uid}`).update({ active: false });
  await assert.rejects(api(buyer, 'profile'), denied);
  await assert.rejects(api(seller, 'message', { conversationId: chat.id, text: 'Must not send', requestId: 'revoked' }), denied);
  await assert.rejects(api(seller, 'sale', { listingId: id, buyerUid: buyer.uid }), denied);
  assert.equal((await db.doc(`transactions/${id}`).get()).exists, false);
  assert.equal((await db.collection(`conversations/${chat.id}/messages`).get()).size, 0);
});
test('membership does not override campus, verification, closure or suspension', async () => {
  await invite(seller);
  await assert.rejects(api({ ...seller, email: 'changed@uga.edu' }, 'profile'), denied);
  await assert.rejects(api({ ...seller, email_verified: false }, 'profile'), denied);
  await db.doc(`moderationAccounts/${seller.uid}`).set({ suspended: true });
  await assert.rejects(api(seller, 'profile'), denied);
  await db.doc(`moderationAccounts/${seller.uid}`).delete();
  await db.doc(`accountLifecycle/${seller.uid}`).set({ closed: true });
  await assert.rejects(api(seller, 'profile'), denied);
});
test('malformed configuration is denied; absent policy preserves protected development behavior', async () => {
  await invite(seller);
  for (const bad of [{}, { mode: 'open', campusId: 'emory.edu' }, { mode: 'invite-only', campusId: 'uga.edu' }]) {
    await db.doc('betaSettings/access').set(bad);
    await assert.rejects(api(seller, 'profile'), denied);
  }
  await db.doc('betaSettings/access').delete();
  await api(buyer, 'profile');
  assert.equal((await db.doc(`users/${buyer.uid}`).get()).data().campusId, 'emory.edu');
});
test('beta server denies missing policy even when membership exists, without changing development behavior', async () => {
  const betaDb = { projectId: 'quadmart-beta', doc: db.doc.bind(db), runTransaction: db.runTransaction.bind(db) };
  await invite(seller);
  await db.doc('betaSettings/access').delete();
  await assert.rejects(operate(betaDb, seller, 'profile', {}), denied);
  assert.equal((await db.doc(`users/${seller.uid}`).get()).exists, false);
  await db.doc('betaSettings/access').set(policy);
  await operate(betaDb, seller, 'profile', {});
  assert.equal((await db.doc(`users/${seller.uid}`).get()).data().campusId, 'emory.edu');
});
test('uninvited photo upload/delivery and revoked photo owner are denied before provider access', async () => {
  const auth = { verifyIdToken: async () => seller };
  let stored = false;
  const request = new Request('http://localhost/api/upload', { method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: 'unused' });
  await assert.rejects(uploadPhoto(request, { db, auth, projectId: 'demo-quadmart', storeImage: async () => { stored = true; } }), denied);
  const photo = 'a'.repeat(64);
  const view = new Request('http://localhost/api/photos/' + photo, { headers: { authorization: 'Bearer synthetic' } });
  await assert.rejects(authorizePhoto(view, photo, { db, auth }), denied);
  assert.equal(stored, false); assert.equal((await db.collection('media').get()).size, 0);
  await invite(seller);
  await db.doc(`media/${photo}`).set({ ownerUid: buyer.uid, campusId: 'emory.edu', status: 'ready', publicId: 'synthetic' });
  await assert.rejects(authorizePhoto(view, photo, { db, auth }), denied);
});
test('revoked membership does not prevent a recent-auth closure request', async () => {
  await invite(seller); await api(seller, 'profile');
  await db.doc(`betaAccess/${seller.uid}`).update({ active: false });
  await api({ ...seller, auth_time: Date.now() / 1000 }, 'accountClose', { confirmation: 'DELETE' });
  assert.equal((await db.doc(`accountLifecycle/${seller.uid}`).get()).data().closed, true);
});
test('HTTP boundary exposes a safe invitation denial and fails closed on a policy read outage', async () => {
  const request = () => new Request('http://localhost/api/market', { method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: JSON.stringify({ action: 'profile', data: {} }) });
  const handler = services => createMarketHandler({ backend: () => ({ auth: { verifyIdToken: async () => seller }, db: services }), consume: async () => {}, log: () => {} });
  const deniedResponse = await handler(db)(request());
  assert.equal(deniedResponse.status, 403);
  assert.match((await deniedResponse.json()).error, /invitation-only/);
  const failed = await handler({ doc: () => ({ get: async () => { throw Error('PRIVATE_PROVIDER_FAILURE'); } }) })(request());
  assert.equal(failed.status, 500);
  assert(!(await failed.text()).includes('PRIVATE_PROVIDER_FAILURE'));
});
