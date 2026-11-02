import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'resume-browser');
const auth = getAuth(app), db = getFirestore(app), base = 'http://127.0.0.1:3100';
const password = 'Local-only-resume-password-123!';
let checks = 0;
const errors = [];
const pass = (browser, scenario) => console.log(JSON.stringify({ resumeCheck: ++checks, browser, scenario }));
async function shot(page, name) {
  if (!process.env.QUADMART_SCREENSHOT_DIRECTORY) return;
  await fs.mkdir(process.env.QUADMART_SCREENSHOT_DIRECTORY, { recursive: true });
  await page.screenshot({ path: path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY, name + '.png'), animations: 'disabled' });
}
async function navigate(page, name) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name, exact: true }).click();
}
async function login(page, email) {
  await page.goto(base + '/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: /Welcome back,/ }).waitFor();
}
try {
  for (const [engine, device, name] of [[chromium, 'Pixel 7', 'chromium-android'], [webkit, 'iPhone 13', 'webkit-iphone']]) {
    for (const [port, suffix] of [[9099, 'accounts'], [8080, 'databases/(default)/documents']]) {
      assert((await fetch(`http://127.0.0.1:${port}/emulator/v1/projects/demo-quadmart/${suffix}`, { method: 'DELETE' })).ok);
    }
    const seller = 'resume-seller', buyer = 'resume-buyer';
    for (const uid of [seller, buyer]) await auth.createUser({ uid, email: `${uid}@emory.edu`, password, emailVerified: true, displayName: uid });
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ browser: name, error: String(error) }));
    try {
      // A shorter local expiry hint exercises the real SDK renewal timer.
      // No JWT changes, clock bypasses, cloud accounts or attestation services.
      await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword*', async route => {
        const response = await route.fetch();
        const body = await response.json();
        if (response.ok()) body.expiresIn = '330';
        await route.fulfill({ response, json: body });
      });
      await login(page, `${seller}@emory.edu`);
      await navigate(page, 'Settings');
      const draft = page.getByPlaceholder('Your name', { exact: true });
      await draft.fill('Unsaved phone draft');
      let rejectedChecks = 0;
      await page.route('**/api/market', route => {
        if (route.request().postDataJSON()?.action === 'profile') {
          rejectedChecks++;
          return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Account check temporarily unavailable. Please retry."}' });
        }
        return route.continue();
      });
      await page.waitForResponse(response => response.url().includes('/securetoken.googleapis.com/v1/token') && response.ok(), { timeout: 45000 });
      await page.getByRole('alert').filter({ hasText: /temporarily unavailable/ }).waitFor();
      await shot(page, `${name}-renewal-recovery`);
      assert.equal(await draft.count(), 1, 'A temporary renewal check must not unmount the draft');
      assert(await draft.isVisible());
      assert.equal(await draft.inputValue(), 'Unsaved phone draft');
      await page.setViewportSize({ width: 320, height: 360 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const retry = page.getByRole('button', { name: 'Retry account setup', exact: true });
      await retry.scrollIntoViewIfNeeded();
      assert((await retry.boundingBox()).height >= 44);
      await page.setViewportSize(devices[device].viewport);
      assert.equal(rejectedChecks, 1, 'No automatic account-check retry loop');
      pass(name, 'temporary post-renewal failure preserves the page and unsaved draft');
      await page.unroute('**/api/market');
      let shortRefresh = name === 'chromium-android';
      await page.route('**/securetoken.googleapis.com/v1/token*', async route => {
        const response = await route.fetch(), body = await response.json();
        if (response.ok() && shortRefresh) { body.expires_in = '60'; shortRefresh = false; }
        await route.fulfill({ response, json: body });
      });
      await page.getByRole('button', { name: 'Retry account setup', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /temporarily unavailable/ }).waitFor({ state: 'hidden' });
      assert.equal(await draft.inputValue(), 'Unsaved phone draft');
      assert.equal((await db.doc(`users/${seller}`).get()).data().displayName, seller);
      pass(name, 'manual renewal recovery retains unsaved input without submitting it');
      if (name === 'chromium-android') {
        // A renderer freeze exercises deferred timers, not a phone OS or radio.
        // Wait into this SDK's 30-second on-demand refresh buffer in real
        // wall time after the local 60-second expiry hint above.
        const lifecycle = await context.newCDPSession(page);
        await lifecycle.send('Page.setWebLifecycleState', { state: 'frozen' });
        let renewed;
        try {
          await new Promise(resolve => setTimeout(resolve, 35000));
          renewed = page.waitForResponse(response => response.url().includes('/securetoken.googleapis.com/v1/token') && response.ok(), { timeout: 20000 });
        }
        finally { await lifecycle.send('Page.setWebLifecycleState', { state: 'active' }); }
        assert.equal(await draft.inputValue(), 'Unsaved phone draft');
        assert.equal(new URL(page.url()).pathname, '/settings');
        // After background throttling, a user action must also request a fresh
        // token rather than depend on the background timer having fired.
        await page.getByRole('button', { name: 'Save Name', exact: true }).click();
        await renewed;
        await page.getByText('Display name updated.', { exact: true }).waitFor();
        assert.equal((await db.doc(`users/${seller}`).get()).data().displayName, 'Unsaved phone draft');
        await lifecycle.detach();
        pass(name, 'resumed renderer preserves its draft and refreshes the token for a user action');
      }
      // A real browser offline transition must not turn into sign-out or a save.
      await draft.fill('Reconnected phone draft');
      await context.setOffline(true);
      await page.route('**/identitytoolkit.googleapis.com/v1/accounts:update*', route => route.abort('internetdisconnected'));
      await page.getByRole('button', { name: 'Save Name', exact: true }).click();
      await page.getByText('Failed to update name. Please try again.', { exact: true }).waitFor();
      assert.equal(await draft.inputValue(), 'Reconnected phone draft');
      assert.equal(new URL(page.url()).pathname, '/settings');
      await context.setOffline(false);
      await page.unroute('**/identitytoolkit.googleapis.com/v1/accounts:update*');
      await page.getByRole('button', { name: 'Save Name', exact: true }).click();
      await page.getByText('Display name updated.', { exact: true }).waitFor();
      assert.equal((await db.doc(`users/${seller}`).get()).data().displayName, 'Reconnected phone draft');
      pass(name, 'offline save keeps the draft and reconnecting permits one explicit save');
      await shot(page, `${name}-reconnected`);
      const otherTab = await context.newPage();
      await otherTab.goto(base + '/settings');
      await otherTab.getByPlaceholder('Your name', { exact: true }).waitFor();
      assert.equal(await otherTab.getByPlaceholder('Your name', { exact: true }).inputValue(), 'Reconnected phone draft');
      await draft.fill('Seller-only unsent draft');
      await otherTab.getByRole('button', { name: 'Open menu', exact: true }).click();
      await otherTab.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Log out', exact: true }).click();
      await page.waitForURL('**/login');
      assert.equal(await draft.count(), 0);
      pass(name, 'logout in another tab removes the first tab private page and draft');
      const otherAccountReady = page.waitForResponse(response => response.url().endsWith('/api/market') && response.request().postDataJSON()?.action === 'safetyStatus' && response.ok());
      await login(otherTab, `${buyer}@emory.edu`);
      await otherAccountReady;
      // Client navigation keeps this check independent of WebKit's known
      // loopback long-poll cancellation diagnostic during full-page unload.
      await page.getByRole('link', { name: 'Marketplace', exact: true }).last().click();
      await page.waitForURL('**/marketplace');
      await page.getByRole('button', { name: 'Open menu', exact: true }).waitFor();
      await navigate(page, 'Settings');
      await page.getByText(`${buyer}@emory.edu`, { exact: true }).waitFor();
      assert.equal(await draft.inputValue(), buyer);
      assert.equal(await page.getByText(`${seller}@emory.edu`, { exact: true }).count(), 0);
      assert.equal((await db.doc(`users/${seller}`).get()).data().displayName, 'Reconnected phone draft');
      pass(name, 'second-account sign-in propagates without exposing the first account draft');
      await otherTab.close();
      await db.doc(`moderationAccounts/${buyer}`).set({ suspended: true });
      await page.getByRole('alert').filter({ hasText: 'Your account is suspended.' }).waitFor();
      assert.equal(await draft.count(), 0);
      await db.doc(`moderationAccounts/${buyer}`).set({ suspended: false });
      await draft.waitFor();
      pass(name, 'suspension still blocks private UI and restoration recovers access');
    } catch (error) {
      await shot(page, `${name}-resume-failure`);
      throw error;
    } finally {
      page.removeAllListeners('pageerror');
      await context.close(); await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, resumeChecks: checks, pageErrors: errors.length }));
} finally { await db.terminate(); await deleteApp(app); }
