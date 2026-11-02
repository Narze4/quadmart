import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionDiagnostics, developmentDiagnosticsEnabled } from '../lib/server/session-diagnostics.mjs';
import { SafetyError } from '../lib/server/safety.mjs';
import { RateLimitError } from '../lib/server/limits.mjs';

const env = { VERCEL_ENV: 'preview', FIREBASE_ADMIN_PROJECT_ID: 'quadmart-development', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quadmart-development', NEXT_PUBLIC_ENABLE_APP_CHECK: 'true', NEXT_PUBLIC_FIREBASE_APP_ID: 'dev-app' };
const seconds = 1800000000;
const actor = { uid: 'private-uid', email: 'private@emory.edu', email_verified: true, iat: seconds - 100, exp: seconds + 3500, auth_time: seconds - 1000 };
const claims = { app_id: 'dev-app', iat: seconds - 200, exp: seconds + 3400, private: 'must-not-appear' };
const secret = 'synthetic-secret-must-not-appear';
function setup(overrides = {}) {
  const calls = [];
  const services = { db: {}, auth: { verifyIdToken: async (token, revoked) => { calls.push(['auth', token, revoked]); return actor; } } };
  const handler = createSessionDiagnostics({
    env, now: () => seconds * 1000, backend: () => services,
    consume: async (...args) => { calls.push(['quota', ...args.slice(1)]); },
    active: async () => { calls.push(['active']); },
    // Match Firebase Admin VerifyAppCheckTokenResponse, not decoded claims alone.
    verifyAppCheck: async (_services, token) => { calls.push(['appcheck', token]); return { appId: claims.app_id, token: claims }; }, ...overrides,
  });
  const request = (headers = {}) => new Request('https://preview.example/api/development/session-check', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'x-firebase-appcheck': secret, ...headers } });
  return { handler, request, calls, services };
}
test('diagnostics are absent outside attested development preview, including emulators', async () => {
  assert(developmentDiagnosticsEnabled(env));
  for (const change of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: undefined }, { FIREBASE_ADMIN_PROJECT_ID: 'quadmart-4410f' }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quadmart-4410f' }, { NEXT_PUBLIC_ENABLE_APP_CHECK: 'false' }, { QUADMART_LOCAL: 'true' }, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }]) {
    const { handler, request, calls } = setup({ env: { ...env, ...change } });
    assert.equal((await handler(request())).status, 404); assert.equal(calls.length, 0);
  }
});
test('verified results contain only safe timestamps and cannot be cached', async () => {
  const { handler, request, calls } = setup();
  const response = await handler(request()), body = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Object.keys(body).sort(), ['appCheck', 'auth', 'checkedAt', 'project']);
  assert.equal(body.appCheck.issuedAt, new Date(claims.iat * 1000).toISOString());
  assert.deepEqual(Object.keys(body.appCheck).sort(), ['expiresAt', 'issuedAt']);
  assert.deepEqual(Object.keys(body.auth).sort(), ['expiresAt', 'issuedAt', 'signedInAt']);
  for (const privateValue of [secret, actor.uid, actor.email, claims.private]) assert(!JSON.stringify(body).includes(privateValue));
  assert.deepEqual(calls.map(c => c[0]), ['auth', 'quota', 'active', 'appcheck']);
  assert.equal(calls[0][2], true);
});
test('missing, oversized and revoked Auth tokens never reach App Check', async () => {
  const basic = setup();
  for (const authorization of ['', 'Bearer ' + 'x'.repeat(16384)]) assert.equal((await basic.handler(basic.request({ authorization }))).status, 401);
  assert.equal(basic.calls.length, 0);
  const revoked = setup({ backend: () => ({ auth: { verifyIdToken: async () => { throw Error(secret); } } }) });
  const response = await revoked.handler(revoked.request());
  assert.equal(response.status, 401); assert(!(await response.text()).includes(secret));
});
test('unverified, unsupported and suspended accounts cannot use diagnostics', async () => {
  for (const invalid of [{ ...actor, email_verified: false }, { ...actor, email: 'private@example.com' }]) {
    const { handler, request, calls } = setup({ backend: () => ({ auth: { verifyIdToken: async () => invalid } }) });
    assert.equal((await handler(request())).status, 403); assert.equal(calls.length, 0);
  }
  const suspended = setup({ active: async () => { throw new SafetyError(secret, 403); } });
  assert.equal((await suspended.handler(suspended.request())).status, 403);
  assert(!suspended.calls.some(c => c[0] === 'appcheck'));
});
test('missing, invalid, wrong-app and expired attestation fail closed without diagnostics', async () => {
  for (const change of [
    { verifyAppCheck: async () => { throw Error(secret); } },
    { verifyAppCheck: async () => ({ token: { ...claims, app_id: 'another-app' } }) },
    { verifyAppCheck: async () => ({ token: { ...claims, exp: seconds - 1 } }) },
    { verifyAppCheck: async () => ({ token: { ...claims, iat: seconds + 90 } }) },
    { verifyAppCheck: async () => ({ token: { ...claims, iat: NaN } }) },
    { verifyAppCheck: async () => ({}) },
    { verifyAppCheck: async () => claims },
    { env: { ...env, NEXT_PUBLIC_FIREBASE_APP_ID: '' } },
  ]) {
    const { handler, request } = setup(change), response = await handler(request());
    assert.equal(response.status, 403); assert(!(await response.text()).includes(secret));
  }
  const { handler, request, calls } = setup();
  for (const token of ['', 'x'.repeat(16385)]) assert.equal((await handler(request({ 'x-firebase-appcheck': token }))).status, 403);
  assert(!calls.some(c => c[0] === 'appcheck'));
});
test('quota and dependency failures are bounded and redact raw errors', async () => {
  const throttled = setup({ consume: async () => { throw new RateLimitError(30); } });
  const limited = await throttled.handler(throttled.request());
  assert.equal(limited.status, 429); assert(limited.headers.has('retry-after'));
  const failed = setup({ backend: () => { throw Error(secret); } });
  const response = await failed.handler(failed.request());
  assert.equal(response.status, 503); assert(!(await response.text()).includes(secret));
});
