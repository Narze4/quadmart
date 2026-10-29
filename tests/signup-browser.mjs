import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'signup-browser');
const auth = getAuth(app), base = 'http://127.0.0.1:3100';
const endpoint = '**/identitytoolkit.googleapis.com/v1/accounts:signUp*';
let checks = 0;
const errors = [];
const pass = (browser, scenario) => console.log(JSON.stringify({ signupCheck: ++checks, browser, scenario }));
try {
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts', { method: 'DELETE' });
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
  for (const [engine, device, name] of [[chromium, 'Pixel 7', 'chromium-android'], [webkit, 'iPhone 13', 'webkit-iphone']]) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    try {
      let release;
      const hydrated = new Promise(resolve => { release = resolve; });
      await page.route('**/_next/static/**/*.js', async route => { await hydrated; await route.continue(); });
      try {
        await page.goto(base + '/signup', { waitUntil: 'commit' });
        await page.getByLabel('University Email', { exact: true }).waitFor();
        assert(await page.getByLabel('University Email', { exact: true }).isDisabled());
        assert(await page.getByRole('button', { name: 'Create Account', exact: true }).isDisabled());
      } finally { release(); }
      await page.waitForLoadState('load');
      await page.unroute('**/_next/static/**/*.js');
      const email = page.getByLabel('University Email', { exact: true });
      const password = page.getByLabel('Password', { exact: true });
      const submit = page.getByRole('button', { name: 'Create Account', exact: true });
      await email.fill(`signup-${name}@emory.edu`);
      let attempts = 0;
      page.on('request', req => { if (req.url().includes('/accounts:signUp')) attempts++; });
      await password.fill('short');
      await submit.click();
      assert.equal(attempts, 0);
      assert.equal(await password.evaluate(el => el.validity.tooShort), true);
      await email.fill('unsupported@example.edu');
      assert(await submit.isDisabled());
      pass(name, 'cold hydration, short password and unsupported campus prevent submission');
      await email.fill(`signup-${name}@emory.edu`);
      await password.fill('Local-only-signup-password-123!');
      await page.route(endpoint, route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } }) }));
      await submit.click();
      await page.getByRole('alert').filter({ hasText: 'Too many attempts' }).waitFor();
      assert.equal(attempts, 1);
      assert.equal(await password.inputValue(), 'Local-only-signup-password-123!');
      pass(name, 'provider throttling keeps entered values and offers a safe retry');
      await page.unroute(endpoint);
      await auth.createUser({ email: `signup-${name}@emory.edu`, password: 'Local-only-existing-password-123!' });
      await submit.click();
      await page.getByRole('alert').filter({ hasText: 'Could not create this account.' }).waitFor();
      assert.equal(attempts, 2);
      assert(!(await page.getByRole('alert').filter({ hasText: 'Could not create this account.' }).innerText()).includes('already exists'));
      pass(name, 'existing-account response stays generic');
      await email.fill(`fresh-signup-${name}@emory.edu`);
      let releaseSignup;
      const gate = new Promise(resolve => { releaseSignup = resolve; });
      await page.route(endpoint, async route => { await gate; await route.continue(); });
      try {
        await submit.click();
        await page.getByRole('button', { name: 'Creating account…', exact: true }).waitFor();
        // Exercise two submissions in the same browser turn, before a React rerender.
        await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
        assert.equal(attempts, 3);
        assert(await email.isDisabled());
      } finally { releaseSignup(); }
      await page.waitForURL('**/verify-email');
      await page.getByRole('heading', { name: /Check your inbox|Verify your university email/ }).waitFor();
      assert.equal(attempts, 3);
      const user = await auth.getUserByEmail(`fresh-signup-${name}@emory.edu`);
      assert.equal(user.emailVerified, false);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (process.env.QUADMART_SCREENSHOT_DIRECTORY) {
        await fs.mkdir(process.env.QUADMART_SCREENSHOT_DIRECTORY, { recursive: true });
        await page.screenshot({ path: path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY, `${name}-signup-verification.png`) });
      }
      pass(name, 'duplicate submit creates one unverified account and opens verification');
    } finally {
      page.removeAllListeners('pageerror');
      await context.close(); await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, signupChecks: checks, pageErrors: errors.length }));
} finally { await deleteApp(app); }
