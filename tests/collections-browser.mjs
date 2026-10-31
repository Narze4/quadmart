import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'collections-browser'), db = getFirestore(app), auth = getAuth(app);
const seller = 'collections-seller', buyer = 'collections-buyer', password = 'Local-only-password-123!', base = 'http://127.0.0.1:3100';
const originalRules = await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let checks = 0, changedRules = false;
const errors = []; page.on('pageerror', error => errors.push(error.message));
const pass = () => { checks++; console.log(JSON.stringify({ collectionBrowserCheck: checks })); };
const owned = i => `owned-${String(i).padStart(3, '0')}`;
async function rules(source) { const env = await initializeTestEnvironment({ projectId: 'demo-quadmart', firestore: { rules: source } }); await env.cleanup(); }
async function login(target, email) { await target.goto(base + '/login'); await target.locator('input[type=email]').fill(email); await target.locator('input[type=password]').fill(password); await target.getByRole('button', { name: /log in/i }).click(); await target.waitForURL('**/dashboard'); }
async function text(target, value) { await target.getByText(value, { exact: true }).waitFor(); }
const ownRow = title => page.locator('main a[href^="/listing/"]').filter({ has: page.getByText(title, { exact: true }) }).locator('..');
async function shot(name) { if (process.env.QUADMART_SCREENSHOT_DIRECTORY) { await fs.mkdir(process.env.QUADMART_SCREENSHOT_DIRECTORY, { recursive: true }); await page.screenshot({ animations: 'disabled', path: path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY, `${name}.png`) }); } }
try {
  await fetch(base.replace(':3100', ':8080') + '/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
  await fetch(base.replace(':3100', ':9099') + '/emulator/v1/projects/demo-quadmart/accounts', { method: 'DELETE' });
  for (const [uid, email] of [[seller, 'collections-seller@emory.edu'], [buyer, 'collections-buyer@emory.edu']]) await auth.createUser({ uid, email, password, emailVerified: true });
  const createdAt = Timestamp.fromMillis(1793200000000), batch = db.batch();
  for (const [uid, name, ids] of [[seller, 'Collection Seller', [...Array.from({ length: 63 }, (_, i) => owned(i)), 'missing', 'foreign']], [buyer, 'Collection Buyer', ['0000']]]) {
    const profile = { uid, displayName: name, campusId: 'emory.edu', university: 'Emory University', transactions: 0, createdAt };
    batch.set(db.doc(`users/${uid}`), { ...profile, email: `${uid}@emory.edu`, savedListings: ids }); batch.set(db.doc(`publicProfiles/${uid}`), profile);
  }
  const listing = { campusId: 'emory.edu', category: 'Product', condition: 'Good', description: 'Synthetic local test listing', price: 25, images: [], imageIds: [], createdAt, version: 0 };
  for (let i = 0; i < 90; i++) batch.set(db.doc(`listings/${owned(i)}`), { ...listing, sellerUid: seller, title: `Owned ${i}`, status: ['active', 'reserved', 'sold'][i % 3] });
  for (let i = 0; i < 133; i++) batch.set(db.doc(`listings/${String(i).padStart(4, '0')}`), { ...listing, sellerUid: buyer, status: 'active', category: i === 1 ? 'Service' : 'Product', title: i === 0 ? 'Rare oldest bicycle' : i === 1 ? 'Older campus service' : `Campus ${i}` });
  batch.set(db.doc('listings/foreign'), { ...listing, sellerUid: seller, status: 'active', campusId: 'uga.edu', title: 'Hidden foreign listing' });
  for (let i = 0; i < 64; i++) {
    batch.set(db.doc(`conversations/000-${String(i).padStart(3, '0')}`), { listingId: owned(84), participants: [seller, `candidate-${i}`], campusId: 'emory.edu', createdAt, lastMessageAt: createdAt });
    batch.set(db.doc(`publicProfiles/candidate-${i}`), { campusId: 'emory.edu', displayName: `Candidate ${i}`, createdAt });
  }
  const conversationId = createHash('sha256').update(JSON.stringify([owned(84), buyer])).digest('hex');
  batch.set(db.doc(`conversations/${conversationId}`), { listingId: owned(84), listingTitle: 'Owned 84', participants: [seller, buyer], participantNames: ['Collection Seller', 'Collection Buyer'], campusId: 'emory.edu', createdAt, lastMessageAt: createdAt });
  await batch.commit();
  await login(page, 'collections-seller@emory.edu'); await text(page, 'Recently added'); await page.waitForFunction(() => document.querySelectorAll('main a[href^="/listing/"]').length === 8); assert.equal(await page.getByText('Popular categories', { exact: true }).count(), 0); pass();
  await shot('dashboard');
  await page.getByPlaceholder('Search your campus listings…').fill('oldest bicycle'); await text(page, 'No matches in this batch'); await page.getByRole('button', { name: 'Continue searching', exact: true }).click(); await text(page, 'Rare oldest bicycle'); await text(page, '1 listing loaded'); pass();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click(); await text(page, 'Browse by category'); await page.getByRole('button', { name: 'Service', exact: true }).click(); await text(page, 'Older campus service'); await text(page, '1 listing loaded'); pass();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click(); await text(page, 'Recently added');
  await page.context().setOffline(true); await page.getByPlaceholder('Search your campus listings…').fill('owned'); await text(page, 'Something went wrong');
  await page.context().setOffline(false); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await text(page, '24 listings loaded so far'); pass();
  await page.goto(base + '/my-listings'); await text(page, '24 active listings loaded so far');
  await page.context().setOffline(true); await page.getByRole('button', { name: 'Load older listings', exact: true }).click(); await text(page, 'Could not load these results. Please try again.'); assert.equal(await page.locator('main a[href^="/listing/"]').count(), 24);
  await page.context().setOffline(false); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await text(page, '30 active listings loaded');
  for (const tab of ['Reserved', 'Sold']) { await page.getByRole('button', { name: tab, exact: true }).click(); await text(page, `24 ${tab.toLowerCase()} listings loaded so far`); await page.getByRole('button', { name: 'Load older listings', exact: true }).click(); await text(page, `30 ${tab.toLowerCase()} listings loaded`); }
  assert.equal(await page.getByText('Hidden foreign listing', { exact: true }).count(), 0); assert.equal(await page.getByText('Campus 132', { exact: true }).count(), 0); pass();
  await page.getByRole('button', { name: 'Active', exact: true }).click(); await text(page, 'Owned 87');
  await ownRow('Owned 87').getByRole('button', { name: 'Mark as Reserved', exact: true }).click(); await page.getByText('Owned 87', { exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Reserved', exact: true }).click(); await text(page, 'Owned 87'); await ownRow('Owned 87').getByRole('button', { name: 'Back to Active', exact: true }).click(); await page.getByText('Owned 87', { exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Active', exact: true }).click(); await text(page, 'Owned 87'); assert.equal((await db.doc(`listings/${owned(87)}`).get()).data().version, 2); pass();
  await db.doc(`listings/${owned(87)}`).update({ status: 'reserved', version: 3 }); await ownRow('Owned 87').getByRole('button', { name: 'Mark as Reserved', exact: true }).click(); await page.getByRole('alert').waitFor(); await page.getByText('Owned 87', { exact: true }).waitFor({ state: 'detached' }); pass();
  await ownRow('Owned 84').getByRole('button', { name: 'Mark as Sold', exact: true }).click(); const dialog = page.getByRole('dialog'); await text(page, '24 buyers loaded so far'); assert.equal(await dialog.getByRole('button', { name: 'Confirm', exact: true }).isEnabled(), false);
  await dialog.getByRole('button', { name: 'Load more buyers', exact: true }).click(); await text(page, '48 buyers loaded so far'); await dialog.getByRole('button', { name: 'Load more buyers', exact: true }).click(); await text(page, '65 buyers loaded'); await dialog.getByRole('radio', { name: /Collection Buyer/ }).check(); await dialog.getByRole('button', { name: 'Confirm', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
  assert.equal((await db.doc(`transactions/${owned(84)}`).get()).data().buyerUid, buyer); await page.getByRole('button', { name: 'Sold', exact: true }).click(); await text(page, 'Owned 84'); pass();
  await shot('my-listings');
  await page.goto(base + '/saved'); await text(page, '24 saved items loaded so far'); assert.equal(await page.getByText('Listing unavailable', { exact: true }).count(), 2); assert.equal(await page.getByText('Hidden foreign listing', { exact: true }).count(), 0);
  await page.context().setOffline(true); await page.getByRole('button', { name: 'Load more saved items', exact: true }).click(); await text(page, 'Could not load these results. Please try again.'); assert.equal(await page.getByText('No saved items yet', { exact: true }).count(), 0);
  await page.context().setOffline(false); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await text(page, '48 saved items loaded so far'); await page.getByRole('button', { name: 'Load more saved items', exact: true }).click(); await text(page, '65 saved items loaded'); pass();
  await page.locator('main article').first().getByRole('button', { name: 'Remove from saved', exact: true }).click(); await text(page, '24 saved items loaded so far'); await page.getByText('Listing unavailable', { exact: true }).first().waitFor();
  await page.locator('main a[href^="/listing/"]').filter({ has: page.getByText('Owned 62', { exact: true }) }).getByRole('button', { name: 'Remove from saved', exact: true }).click(); await page.getByText('Owned 62', { exact: true }).waitFor({ state: 'detached' });
  const saves = (await db.doc(`users/${seller}`).get()).data().savedListings; assert(!saves.includes('foreign')); assert(!saves.includes(owned(62))); pass(); await text(page, '24 saved items loaded so far'); await shot('saved');
  // Denied writes stay visible and retryable; they never silently change a heart.
  await page.goto(base + '/dashboard'); await text(page, 'Recently added'); const card = page.locator('main a[href^="/listing/"]').first(); const cardId = (await card.getAttribute('href')).split('/').at(-1);
  await page.route('**/api/market', route => route.request().postDataJSON()?.action === 'savedSet' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test write failure' }) }) : route.continue());
  await card.getByRole('button', { name: 'Save listing', exact: true }).click(); await text(page, 'Could not update saved items. Please try again.'); assert(!(await db.doc(`users/${seller}`).get()).data().savedListings.includes(cardId));
  await page.unroute('**/api/market'); await card.getByRole('button', { name: 'Save listing', exact: true }).click(); await card.getByRole('button', { name: 'Remove from saved', exact: true }).waitFor(); pass();
  // A private saved-list read error must not masquerade as an empty collection.
  await rules(originalRules.replace('allow get: if student() && request.auth.uid == uid;', 'allow get: if false && student() && request.auth.uid == uid;')); changedRules = true;
  await page.goto(base + '/saved'); await text(page, 'Could not load saved items. Please try again.'); assert.equal(await page.getByText('No saved items yet', { exact: true }).count(), 0);
  await rules(originalRules); changedRules = false; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await text(page, '24 saved items loaded so far'); pass();
  // The buyer sees their own saves/listings and the sale completed by the seller.
  const context = await browser.newContext(), buyerPage = await context.newPage(); buyerPage.on('pageerror', error => errors.push(error.message));
  try {
    await login(buyerPage, 'collections-buyer@emory.edu'); await buyerPage.goto(base + '/saved'); await text(buyerPage, 'Rare oldest bicycle'); await text(buyerPage, '1 saved item loaded'); assert.equal(await buyerPage.getByText('Owned 61', { exact: true }).count(), 0);
    await buyerPage.goto(base + '/my-listings'); await text(buyerPage, '24 active listings loaded so far');
    for (const count of [48, 72, 96, 120, 133]) { await buyerPage.getByRole('button', { name: 'Load older listings', exact: true }).click(); await text(buyerPage, `${count} active listings loaded${count < 133 ? ' so far' : ''}`); }
    assert.equal(await buyerPage.getByText('Owned 84', { exact: true }).count(), 0); await buyerPage.getByRole('button', { name: 'Sold', exact: true }).click(); await text(buyerPage, 'No sold listings');
    await buyerPage.goto(base + '/my-purchases'); await text(buyerPage, 'Owned 84'); await buyerPage.getByRole('link', { name: 'Leave a Review', exact: true }).click(); await buyerPage.getByRole('button', { name: '5 stars', exact: true }).click(); await buyerPage.getByPlaceholder('Add a comment (optional)').fill('Two-account collection flow completed'); await buyerPage.getByRole('button', { name: 'Submit Review', exact: true }).click(); await text(buyerPage, 'Review submitted');
    assert.equal((await db.doc(`transactions/${owned(84)}`).get()).data().buyerReviewed, true); pass();
  } finally { await context.close(); }
  await page.getByRole('button', { name: 'Account menu', exact: true }).click(); await page.getByRole('menuitem', { name: 'Log out', exact: true }).click(); await page.waitForURL(url => ['/', '/login'].includes(url.pathname));
  await login(page, 'collections-buyer@emory.edu'); await page.goto(base + '/saved'); await text(page, '1 saved item loaded'); assert.equal(await page.getByText('Owned 61', { exact: true }).count(), 0); await page.getByRole('button', { name: 'Remove from saved', exact: true }).click(); await text(page, 'No saved items yet');
  assert.equal((await db.doc(`users/${buyer}`).get()).data().savedListings.length, 0); assert((await db.doc(`users/${seller}`).get()).data().savedListings.length > 0); pass();
  await db.doc(`users/${buyer}`).update({ savedListings: Array.from({ length: 200 }, (_, i) => `limit-${i}`) });
  await page.goto(base + '/dashboard'); await text(page, 'Recently added'); await page.locator('main a[href^="/listing/"]').first().getByRole('button', { name: 'Save listing', exact: true }).click(); await text(page, 'You can save up to 200 listings. Remove one to save another.');
  assert.equal((await db.doc(`users/${buyer}`).get()).data().savedListings.length, 200); await db.doc(`users/${buyer}`).update({ savedListings: [] }); await page.goto(base + '/saved'); await text(page, 'No saved items yet'); pass();
  assert.equal(errors.length, 0, errors.join('\n')); console.log(JSON.stringify({ status: 'success', collectionBrowserChecks: checks, pageErrors: errors.length }));
} finally { if (changedRules) await rules(originalRules); await browser.close(); await db.terminate(); await deleteApp(app); }
