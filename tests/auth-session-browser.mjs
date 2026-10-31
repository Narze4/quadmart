import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'auth-session-browser');
const auth = getAuth(app), base = 'http://127.0.0.1:3100';
const db = getFirestore(app);
const sendMail = '**/identitytoolkit.googleapis.com/v1/accounts:sendOobCode*';
const refresh = '**/securetoken.googleapis.com/v1/token*';
let checks = 0;
let navigationAborts = 0;
const errors = [];
const pass = (browser, scenario) => console.log(JSON.stringify({ sessionCheck: ++checks, browser, scenario }));
async function codes(email) {
  const response = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/oobCodes');
  assert(response.ok);
  return (await response.json()).oobCodes.filter(code => code.email === email && code.requestType === 'VERIFY_EMAIL');
}
try {
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts', { method: 'DELETE' });
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
  for (const [engine, device, name] of [[chromium, 'Pixel 7', 'chromium-android'], [webkit, 'iPhone 13', 'webkit-iphone']]) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    let navigating = false;
    const navigate = async action => {
      navigating = true;
      try { await action(); } finally { navigating = false; }
    };
    page.on('pageerror', error => {
      // WebKit reports cancelled loopback Firestore long polls as page errors
      // while unloading. Count only that exact navigation diagnostic separately;
      // every other page error, including failures outside navigation, fails.
      if (name === 'webkit-iphone' && navigating && /^Fetch API cannot load http:\s*\/{1,2}127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/Listen\/channel\?.*due to access control checks\.$/.test(String(error))) {
        navigationAborts++;
      } else errors.push({ browser: name, name: error.name, afterCheck: checks });
    });
    const email = `session-${name}@emory.edu`, password = 'Local-only-session-password-123!';
    try {
      // Delivery failure must not force a second account creation.
      await page.route(sendMail, route => route.fulfill({ status: 400, headers: { 'access-control-allow-origin': base }, contentType: 'application/json', body: JSON.stringify({ error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } }) }));
      await page.goto(base + '/signup');
      await page.getByLabel('University Email', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Create Account', exact: true }).click();
      await page.waitForURL('**/verify-email');
      await page.getByText('Too many requests. Wait a few minutes before sending another email.', { exact: true }).waitFor();
      assert.equal((await auth.getUserByEmail(email)).emailVerified, false);
      assert.equal((await codes(email)).length, 0);
      pass(name, 'failed verification delivery preserves the unverified account and resend path');
      await page.unroute(sendMail);
      await page.getByRole('button', { name: 'Send verification email', exact: true }).click();
      await page.getByText('Verification email sent.', { exact: true }).waitFor();
      assert(await page.getByRole('button', { name: /Resend email \(/ }).isDisabled());
      await navigate(async () => {
        await page.reload();
        await page.getByRole('button', { name: /Resend email \(/ }).waitFor();
      });
      assert(await page.getByRole('button', { name: /Resend email \(/ }).isDisabled());
      assert.equal((await codes(email)).length, 1);
      await page.getByRole('button', { name: "I've verified, continue", exact: true }).click();
      await page.getByText(/Still not verified/).waitFor();
      await navigate(async () => {
        await page.goto(base + '/dashboard');
        await page.waitForURL('**/verify-email');
      });
      pass(name, 'resend cooldown survives reload and unverified accounts cannot enter the dashboard');
      const code = (await codes(email)).at(-1);
      assert.equal(new URL(code.oobLink).searchParams.get('continueUrl'), base + '/verify-email');
      const verified = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: code.oobCode }) });
      assert.equal(verified.status, 200);
      // Verify the mail code, then interrupt the separate token exchange.
      await page.route(refresh, route => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': base }, contentType: 'application/json', body: JSON.stringify({ error: { message: 'INTERNAL_ERROR' } }) }));
      await page.getByRole('button', { name: "I've verified, continue", exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /connection|try again/i }).waitFor();
      const recovery = page.getByRole('button', { name: /^(I've verified, continue|Retry account setup)$/ });
      assert(await recovery.isEnabled());
      pass(name, 'verification followed by failed token exchange shows a usable retry instead of a spinner');
      await page.unroute(refresh);
      // Shorten only the local SDK expiry hint; real JWTs and server checks remain intact.
      let refreshes = 0;
      let awaitingRenewal = false;
      await page.route(refresh, async route => {
        const response = await route.fetch();
        const body = await response.json();
        if (response.ok()) { if (!awaitingRenewal) body.expires_in = '330'; refreshes++; }
        await route.fulfill({ response, json: body });
      });
      await recovery.click();
      await page.waitForURL('**/dashboard');
      await page.getByRole('heading', { name: /Welcome back,/ }).waitFor();
      assert.equal((await auth.getUserByEmail(email)).emailVerified, true);
      pass(name, 'mail action plus fresh token unlocks profile setup and dashboard');
      const moderation = db.doc(`moderationAccounts/${(await auth.getUserByEmail(email)).uid}`);
      await moderation.set({ suspended: true });
      await page.getByRole('alert').filter({ hasText: 'Your account is suspended.' }).waitFor();
      await moderation.set({ suspended: false });
      await page.getByRole('heading', { name: /Welcome back,/ }).waitFor();
      pass(name, 'newly verified sessions immediately subscribe to suspension and restoration');
      await navigate(async () => {
        await page.reload();
        await page.getByRole('heading', { name: /Welcome back,/ }).waitFor();
      });
      pass(name, 'verified login persists across a page reload');
      await navigate(async () => {
        await page.goto(base + '/settings');
        await page.getByPlaceholder('Your name', { exact: true }).waitFor();
      });
      await page.getByPlaceholder('Your name', { exact: true }).fill('Unsaved session test');
      const before = refreshes;
      awaitingRenewal = true;
      await page.waitForResponse(response => response.url().includes('/securetoken.googleapis.com/v1/token') && response.ok(), { timeout: 45000 });
      assert(refreshes > before);
      assert.equal(await page.getByPlaceholder('Your name', { exact: true }).inputValue(), 'Unsaved session test');
      assert.equal(new URL(page.url()).pathname, '/settings');
      pass(name, 'automatic SDK token renewal retains the signed-in page and unsaved form');
      await page.unroute(refresh);
      // Revocation affects this emulator account only, never cloud credentials.
      await new Promise(resolve => setTimeout(resolve, 1100));
      await auth.revokeRefreshTokens((await auth.getUserByEmail(email)).uid);
      await page.getByRole('button', { name: 'Save Name', exact: true }).click();
      await page.waitForURL('**/login');
      assert.equal(await page.getByPlaceholder('Your name', { exact: true }).count(), 0);
      pass(name, 'revoked session clears private UI and returns to sign-in');
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole('button', { name: 'Log In', exact: true }).click();
      await page.waitForURL('**/dashboard');
      await page.getByRole('heading', { name: /Welcome back,/ }).waitFor();
      pass(name, 'fresh password sign-in recovers after revocation');
    } finally {
      page.removeAllListeners('pageerror');
      await context.close(); await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, sessionChecks: checks, pageErrors: errors.length, navigationAborts }));
} finally { await db.terminate(); await deleteApp(app); }
