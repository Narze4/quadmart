import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'beta-browser');
const db = getFirestore(app), auth = getAuth(app), base = 'http://127.0.0.1:3100';
const password = 'Synthetic-beta-only-123!';
const policy = { mode: 'invite-only', campusId: 'emory.edu' };
let checks = 0;
let navigationAborts = 0;
const navigating = new Set();
const errors = [];
const pass = browser => console.log(JSON.stringify({ betaBrowserCheck: ++checks, browser }));
async function navigate(page, action) {
  navigating.add(page);
  try { await action(); } finally { navigating.delete(page); }
}
async function login(page, uid) {
  await navigate(page, () => page.goto(base + '/login'));
  await page.getByLabel('Email', { exact: true }).fill(uid + '@emory.edu');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
}
async function admitted(page) {
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: /^Welcome back,/ }).waitFor();
}
const blocked = page => page.getByRole('alert').filter({ hasText: 'This Emory beta is invitation-only.' }).waitFor();
try {
  for (const [engine, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    for (const endpoint of ['http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', 'http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts']) assert((await fetch(endpoint, { method: 'DELETE' })).ok);
    await db.doc('betaSettings/access').set(policy);
    for (const uid of ['beta-seller', 'beta-buyer']) await auth.createUser({ uid, email: uid + '@emory.edu', password, emailVerified: true });
    await db.doc('betaAccess/beta-seller').set({ active: true, campusId: 'emory.edu' });
    const browser = await engine.launch({ headless: true });
    const seller = await browser.newContext(), buyer = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const sp = await seller.newPage(), bp = await buyer.newPage();
    for (const page of [sp, bp]) {
      page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
      page.on('pageerror', error => {
        // Match the existing session suite's exact WebKit loopback long-poll
        // cancellation only during navigation. All other page errors fail.
        if (name === 'webkit' && navigating.has(page) && /^Fetch API cannot load http:\s*\/{1,2}127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/Listen\/channel\?.*due to access control checks\.$/.test(String(error))) navigationAborts++;
        else errors.push({ browser: name, type: error.name, afterCheck: checks });
      });
    }
    try {
      await login(sp, 'beta-seller'); await admitted(sp);
      await login(bp, 'beta-buyer'); await blocked(bp);
      assert.equal((await db.doc('users/beta-buyer').get()).exists, false);
      pass(name);

      await db.doc('betaAccess/beta-buyer').set({ active: true, campusId: 'emory.edu' });
      await bp.getByRole('button', { name: 'Retry account setup', exact: true }).click();
      await admitted(bp);
      assert.equal((await db.doc('users/beta-buyer').get()).data().campusId, 'emory.edu');
      pass(name);

      await db.doc('betaAccess/beta-buyer').update({ active: false });
      await blocked(bp);
      assert.equal(await bp.locator('header').count(), 0);
      await sp.getByRole('heading', { name: /^Welcome back,/ }).waitFor();
      pass(name);

      await db.doc('betaAccess/beta-buyer').update({ active: true });
      await bp.getByRole('heading', { name: /^Welcome back,/ }).waitFor();
      await bp.getByRole('button', { name: 'Open menu', exact: true }).click();
      await bp.getByRole('link', { name: 'Saved', exact: true }).click();
      await bp.getByText('No saved items yet', { exact: true }).waitFor();
      await bp.locator('header a[href="/dashboard"]').click();
      await admitted(bp);
      await navigate(bp, async () => { await bp.reload(); await admitted(bp); });
      pass(name);

      await db.doc('betaSettings/access').set({ mode: 'invalid', campusId: 'emory.edu' });
      await blocked(bp); await blocked(sp);
      await db.doc('betaSettings/access').set(policy);
      await bp.getByRole('heading', { name: /^Welcome back,/ }).waitFor();
      await sp.getByRole('heading', { name: /^Welcome back,/ }).waitFor();
      pass(name);

      await db.doc('betaAccess/beta-buyer').delete(); await blocked(bp);
      await navigate(bp, async () => {
        await bp.getByRole('button', { name: 'Log out', exact: true }).click();
        // Let signOut finish and the protected route redirect before loading a
        // new document. Navigating immediately can cancel persistence cleanup.
        await bp.waitForURL('**/login');
        await bp.locator('#login-email:enabled').waitFor();
      });
      await login(bp, 'beta-seller'); await admitted(bp);
      assert.equal(await bp.getByText('This Emory beta is invitation-only.', { exact: false }).count(), 0);
      pass(name);
    } catch (error) {
      console.log(JSON.stringify({ betaBrowserFailure: true, browser: name, afterCheck: checks,
        path: new URL(bp.url()).pathname, alerts: await bp.getByRole('alert').allTextContents(),
        savedEmptyStateVisible: await bp.getByText('No saved items yet', { exact: true }).isVisible() }));
      throw error;
    } finally {
      for (const page of [sp, bp]) page.removeAllListeners('pageerror');
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ betaBrowserChecks: checks, unexpectedPageErrors: errors.length, navigationAborts, cloudAccountsChanged: 0, realEmailsSent: 0 }));
} finally { await db.terminate(); await deleteApp(app); }
