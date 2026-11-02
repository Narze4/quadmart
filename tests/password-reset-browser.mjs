import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'password-reset-browser');
const auth = getAuth(app), base = 'http://127.0.0.1:3100';
const mail = '**/identitytoolkit.googleapis.com/v1/accounts:sendOobCode*';
const message = 'If an account exists for that email, a reset link is on its way.';
let checks = 0;
const errors = [];
const pass = (browser, scenario) => console.log(JSON.stringify({ resetCheck: ++checks, browser, scenario }));
async function authRequest(action, data) {
  return fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}
try {
  for (const [engine, device, name] of [[chromium, 'Pixel 7', 'chromium-android'], [webkit, 'iPhone 13', 'webkit-iphone']]) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ browser: name, name: error.name, afterCheck: checks }));
    const email = `reset-${name}@emory.edu`, originalPassword = 'Local-reset-original-123!', newPassword = 'Local-reset-replacement-456!';
    try {
      try { await auth.deleteUser((await auth.getUserByEmail(email)).uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      await auth.createUser({ email, emailVerified: true, password: originalPassword });
      const open = async () => {
        await page.goto(base + '/login');
        await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
        await page.getByPlaceholder('you@university.edu').nth(1).fill(email);
      };
      const input = () => page.getByPlaceholder('you@university.edu').nth(1);
      const send = () => page.getByRole('button', { name: 'Send', exact: true });
      const fail = code => route => route.fulfill({ status: 400, headers: { 'access-control-allow-origin': base }, contentType: 'application/json', body: JSON.stringify({ error: { message: code } }) });

      await open();
      let requests = 0, release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(mail, async route => { requests++; await gate; await fail('TOO_MANY_ATTEMPTS_TRY_LATER')(route); });
      const requested = page.waitForRequest(request => request.url().includes('accounts:sendOobCode'), { timeout: 4000 });
      await input().press('Enter');
      try { await requested; } finally { release(); }
      await page.getByText('Too many attempts. Wait a few minutes before trying again.', { exact: true }).waitFor();
      assert.equal(requests, 1);
      assert.equal(await input().inputValue(), email);
      pass(name, 'Enter submits password recovery without requiring the login password');
      await page.unroute(mail);

      let concurrent = 0, releaseSecond;
      const secondGate = new Promise(resolve => { releaseSecond = resolve; });
      await page.route(mail, async route => { concurrent++; await secondGate; await fail('TOO_MANY_ATTEMPTS_TRY_LATER')(route); });
      const first = page.waitForRequest(request => request.url().includes('accounts:sendOobCode'));
      await send().click(); await first;
      assert(await send().isDisabled());
      await input().press('Enter');
      releaseSecond();
      await page.getByText('Too many attempts. Wait a few minutes before trying again.', { exact: true }).waitFor();
      assert.equal(concurrent, 1);
      pass(name, 'one reset request at a time and throttling retains the email');
      await page.unroute(mail);

      await page.route(mail, fail('Firebase App Check token is invalid.'));
      await send().click();
      await page.getByText('The security check could not finish. Reload this page and try again.', { exact: true }).waitFor();
      assert.equal(await input().inputValue(), email);
      pass(name, 'App Check denial shows security recovery guidance without losing the address');
      await page.unroute(mail);

      await page.route(mail, route => route.abort('internetdisconnected'));
      await send().click();
      await page.getByText('Could not connect. Check your connection before trying again.', { exact: true }).waitFor({ timeout: 20000 });
      assert.equal(await input().inputValue(), email);
      pass(name, 'interrupted delivery retains the address and allows an explicit retry');
      await page.unroute(mail);
      await send().click();
      await page.getByText(message, { exact: true }).waitFor();
      const response = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/oobCodes');
      const code = (await response.json()).oobCodes.filter(item => item.email === email && item.requestType === 'PASSWORD_RESET').at(-1);
      assert(code, 'Expected one emulator reset delivery');
      assert.equal((await authRequest('resetPassword', { oobCode: 'invalid-local-reset-code', newPassword })).status, 400);
      assert.equal((await authRequest('signInWithPassword', { email, password: originalPassword, returnSecureToken: true })).status, 200);
      pass(name, 'an invalid reset link leaves the original login intact');
      assert.equal((await authRequest('resetPassword', { oobCode: code.oobCode, newPassword })).status, 200);
      assert.equal((await authRequest('signInWithPassword', { email, password: originalPassword, returnSecureToken: true })).status, 400);
      assert.equal((await authRequest('signInWithPassword', { email, password: newPassword, returnSecureToken: true })).status, 200);
      assert.equal((await authRequest('resetPassword', { oobCode: code.oobCode, newPassword: originalPassword })).status, 400);
      pass(name, 'emulator reset completes, old password stops working, and the reset link is single-use');

      await open();
      await input().fill(`unused-reset-${name}@emory.edu`);
      await page.route(mail, fail('EMAIL_NOT_FOUND'));
      await send().click();
      await page.getByText(message, { exact: true }).waitFor({ timeout: 4000 });
      pass(name, 'unknown addresses receive the same confirmation as existing accounts');
      await page.unroute(mail);
      assert.equal((await fetch(base + '/api/development/session-check', { method: 'POST' })).status, 404);
    } finally { await context.close(); await browser.close(); }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passwordResetChecks: checks, unexpectedPageErrors: errors.length, realEmailsSent: 0 }));
} finally { await deleteApp(app); }
