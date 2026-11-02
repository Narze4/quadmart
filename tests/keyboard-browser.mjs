import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw Error('Isolated emulators required');
const app = initializeApp({ projectId: 'demo-quadmart' }, 'keyboard-browser');
const db = getFirestore(app), auth = getAuth(app), base = 'http://127.0.0.1:3100';
const password = 'Local-keyboard-only-123!', replacement = 'Local-new-keyboard-456!';
let checks = 0;
const errors = [];
const pass = (browser, scenario) => console.log(JSON.stringify({ keyboardCheck: ++checks, browser, scenario }));
const focused = locator => locator.evaluate(node => node === document.activeElement);
async function contained(page, dialog) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(key);
      // Browser chrome can receive focus at a wrap; background page controls cannot.
      assert(await dialog.evaluate(node => node.contains(document.activeElement) || document.activeElement === document.body), 'Focus escaped to a background control');
    }
  }
}
async function login(page, email) {
  await page.goto(base + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { level: 1 }).waitFor();
}
async function navigate(page, name) {
  const mobile = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await mobile.isVisible()) {
    await mobile.click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name, exact: true }).click();
  } else {
    await page.locator('header').getByRole('link', { name, exact: true }).click();
  }
}
async function screenshot(page, name) {
  if (!process.env.QUADMART_SCREENSHOT_DIRECTORY) return;
  await fs.mkdir(process.env.QUADMART_SCREENSHOT_DIRECTORY, { recursive: true });
  await page.screenshot({ path: path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY, name + '.png'), animations: 'disabled' });
}
try {
  for (const [engine, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents', { method: 'DELETE' });
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts', { method: 'DELETE' });
    for (const uid of ['keyboard-seller', 'keyboard-buyer']) await auth.createUser({ uid, email: uid + '@emory.edu', password, displayName: uid, emailVerified: true });
    const browser = await engine.launch({ headless: true });
    const seller = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const buyer = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const sp = await seller.newPage(), bp = await buyer.newPage();
    for (const page of [sp, bp]) { page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(20000); }
    for (const page of [sp, bp]) page.on('pageerror', error => errors.push({ browser: name, type: error.name, check: checks }));
    try {
      await login(sp, 'keyboard-seller@emory.edu');
      await login(bp, 'keyboard-buyer@emory.edu');
      await db.doc('listings/keyboard-desk').set({ title: 'Keyboard test desk', description: 'Synthetic test listing', sellerUid: 'keyboard-seller', sellerEmail: 'keyboard-seller@emory.edu', campusId: 'emory.edu', status: 'active', price: 25, category: 'Product', condition: 'Good', images: [], imageIds: [], version: 0, createdAt: new Date() });
      await navigate(bp, 'Marketplace');
      await bp.locator('a[href="/listing/keyboard-desk"]').first().click();
      await bp.getByRole('button', { name: /Message Seller/i }).click();
      await bp.waitForURL('**/messages/**');
      await navigate(sp, 'My listings');
      const trigger = sp.getByRole('button', { name: 'Mark as Sold', exact: true });
      await trigger.focus(); await sp.keyboard.press('Enter');
      const sale = sp.getByRole('dialog', { name: 'Who bought this?', exact: true });
      await sale.waitFor();
      assert(await focused(sale.getByRole('button', { name: 'Cancel', exact: true })));
      await sale.getByRole('radio', { name: /keyboard-buyer/ }).waitFor();
      await contained(sp, sale);
      await sp.keyboard.press('Escape'); await sale.waitFor({ state: 'detached' });
      assert(await focused(trigger));
      assert.equal(await sp.evaluate(() => document.body.style.overflow), '');
      pass(name, 'named sale dialog, safe initial focus, keyboard containment, Escape and focus/scroll restoration');

      await trigger.press('Enter'); await sale.waitFor();
      await sale.getByRole('radio', { name: /keyboard-buyer/ }).check();
      let release, requests = 0;
      const gate = new Promise(resolve => { release = resolve; });
      await sp.route('**/api/market', async route => {
        if (route.request().postDataJSON()?.action !== 'sale') return route.continue();
        requests++; await gate;
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporary local test failure"}' });
      });
      const requested = sp.waitForRequest(request => request.url().endsWith('/api/market') && request.postDataJSON()?.action === 'sale');
      await sale.getByRole('button', { name: 'Confirm', exact: true }).press('Enter');
      try {
        await requested;
        await sp.keyboard.press('Escape');
        await sp.mouse.click(5, 5);
        assert(await sale.isVisible());
        assert(await sale.getByRole('button', { name: 'Cancel', exact: true }).isDisabled());
        await sp.keyboard.press('Enter');
        assert.equal(requests, 1);
      } finally { release(); }
      await sale.getByRole('alert').waitFor();
      assert(await sale.getByRole('radio', { name: /keyboard-buyer/ }).isChecked());
      await screenshot(sp, name + '-sale-retry');
      await sp.unroute('**/api/market');
      await sale.getByRole('button', { name: 'Confirm', exact: true }).press('Enter');
      await sale.waitFor({ state: 'detached' });
      assert.equal((await db.doc('transactions/keyboard-desk').get()).data().buyerUid, 'keyboard-buyer');
      await navigate(bp, 'Purchases');
      await bp.getByText('Keyboard test desk', { exact: true }).waitFor();
      pass(name, 'pending sale cannot dismiss or duplicate; failure is announced, selection retained, retry reaches buyer receipt');

      await navigate(bp, 'Marketplace');
      const filters = bp.getByRole('button', { name: /^Filters/ });
      await filters.focus(); await filters.press('Enter');
      const drawer = bp.getByRole('dialog', { name: 'Filters', exact: true });
      await drawer.waitFor();
      assert(await focused(drawer.getByRole('button', { name: 'Close filters', exact: true })));
      await drawer.getByLabel('Sort', { exact: true }).selectOption('price-asc');
      await drawer.getByLabel('Minimum price', { exact: true }).fill('5');
      await contained(bp, drawer);
      await screenshot(bp, name + '-filters');
      await bp.keyboard.press('Escape'); await drawer.waitFor({ state: 'detached' });
      assert(await focused(filters));
      await filters.press('Enter'); await drawer.waitFor();
      assert.equal(await drawer.getByLabel('Minimum price', { exact: true }).inputValue(), '5');
      await drawer.getByRole('button', { name: 'Show results', exact: true }).press('Enter');
      await drawer.waitFor({ state: 'detached' }); assert(await focused(filters));
      pass(name, 'mobile filter labels, keyboard containment, Escape, retained values and Show results focus restoration');
      await filters.press('Enter'); await drawer.waitFor();
      await bp.setViewportSize({ width: 1280, height: 900 });
      await drawer.waitFor({ state: 'detached' });
      assert.equal(await bp.evaluate(() => document.body.style.overflow), '');
      assert.equal(await bp.getByLabel('Minimum price', { exact: true }).inputValue(), '5');
      await bp.getByLabel('Search listings', { exact: true }).focus();
      assert(await focused(bp.getByLabel('Search listings', { exact: true })));
      pass(name, 'desktop resize releases modal/scroll lock and retains filter values');

      await sp.getByRole('button', { name: 'Account menu', exact: true }).click();
      await sp.getByRole('menuitem', { name: 'Settings', exact: true }).click();
      await sp.getByLabel('Display Name', { exact: true }).fill('Keyboard seller renamed');
      await sp.getByRole('button', { name: 'Save Name', exact: true }).press('Enter');
      await sp.getByRole('status').filter({ hasText: 'Display name updated.' }).waitFor();
      assert.equal((await db.doc('publicProfiles/keyboard-seller').get()).data().displayName, 'Keyboard seller renamed');
      await sp.getByRole('button', { name: 'Delete', exact: true }).click();
      await sp.getByLabel('Confirm your password', { exact: true }).fill('Unsubmitted-local-draft');
      await sp.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await sp.getByLabel('Confirm your password', { exact: true }).count(), 0);
      pass(name, 'settings fields have associated labels; name update is announced and closure cancellation preserves account');

      const current = sp.getByLabel('Current Password', { exact: true });
      const next = sp.getByLabel('New Password', { exact: true });
      await current.fill(password); await next.fill('short-six');
      let passwordRequests = 0;
      sp.on('request', request => { if (request.url().includes('accounts:update') && request.postDataJSON()?.password) passwordRequests++; });
      await sp.getByRole('button', { name: 'Update Password', exact: true }).press('Enter');
      assert.equal(await next.evaluate(node => node.validity.tooShort), true);
      assert.equal(passwordRequests, 0);
      await next.fill(replacement);
      const updates = '**/identitytoolkit.googleapis.com/v1/accounts:update*';
      await sp.route(updates, route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"PASSWORD_DOES_NOT_MEET_REQUIREMENTS"}}' }));
      await next.press('Enter');
      await sp.getByRole('alert').filter({ hasText: 'Use a password with at least 12 characters' }).waitFor();
      assert.equal(await next.inputValue(), replacement);
      await sp.unroute(updates);
      await next.press('Enter');
      await sp.getByRole('status').filter({ hasText: 'Password updated successfully.' }).waitFor();
      assert.equal(await current.inputValue(), ''); assert.equal(await next.inputValue(), '');
      const signIn = value => fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'keyboard-seller@emory.edu', password: value, returnSecureToken: true }) });
      assert.equal((await signIn(password)).status, 400);
      assert.equal((await signIn(replacement)).status, 200);
      assert.equal((await auth.getUser('keyboard-buyer')).disabled, false);
      pass(name, 'twelve-character validation, server-policy failure/retry and local password change with old/new login rejection/acceptance');
    } finally {
      for (const page of [sp, bp]) page.removeAllListeners('pageerror');
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ keyboardBrowserChecks: checks, unexpectedPageErrors: errors.length, realEmailsSent: 0, cloudAccountsChanged: 0 }));
} finally { await db.terminate(); await deleteApp(app); }
