import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionRequest } from '../lib/session-request.mjs';

function fixture({ getToken = async () => 'token', send = async () => new Response('{}') } = {}) {
  const user = { uid: 'a', getIdToken: getToken }, auth = { currentUser: null };
  auth.currentUser = user;
  const calls = [], logouts = [];
  const request = createSessionRequest({ auth, signOut: async () => { logouts.push(auth.currentUser?.uid); auth.currentUser = null; }, fetch: async (...args) => { calls.push(args); return send(...args); } });
  return { user, auth, request, calls, logouts };
}
test('renews through the SDK and preserves upload body, headers and cancellation', async () => {
  const f = fixture(), body = new Uint8Array([1, 2]), signal = new AbortController().signal;
  await f.request('/api/upload', { method: 'POST', body, signal, headers: { 'Content-Type': 'image/png', 'X-Upload-Id': 'once' } }, { expectedUid: 'a' });
  assert.equal(f.calls[0][1].body, body);
  assert.equal(f.calls[0][1].signal, signal);
  assert.equal(f.calls[0][1].headers.get('authorization'), 'Bearer token');
  assert.equal(f.calls[0][1].headers.get('x-upload-id'), 'once');
  assert.equal(f.logouts.length, 0);
});
test('401 clears the rejected session without replaying a write', async () => {
  const f = fixture({ send: async () => new Response('private diagnostics', { status: 401 }) });
  await assert.rejects(f.request('/api/market', { method: 'POST', body: '{}' }), error => error.status === 401 && !error.message.includes('private'));
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.logouts, ['a']);
});
test('late 401 cannot sign out a different account or a renewed same-account token', async () => {
  const changed = fixture({ send: async () => { changed.auth.currentUser = { uid: 'b' }; return new Response('', { status: 401 }); } });
  await assert.rejects(changed.request('/api/market'), /account changed/);
  assert.equal(changed.logouts.length, 0);
  let token = 'old';
  const renewed = fixture({ getToken: async () => token, send: async () => { token = 'new'; return new Response('', { status: 401 }); } });
  await assert.rejects(renewed.request('/api/market'), error => error.status === 401);
  assert.equal(renewed.logouts.length, 0);
  assert.equal(renewed.calls.length, 1);
});
test('account changes during token acquisition cannot send a request', async () => {
  const f = fixture({ getToken: async () => { f.auth.currentUser = { uid: 'b' }; return 'private'; } });
  await assert.rejects(f.request('/api/market'), /account changed/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.request('/api/market', {}, { expectedUid: 'a' }), /account changed/);
});
test('terminal SDK token errors clear the session and hide diagnostics', async () => {
  for (const code of ['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found']) {
    const f = fixture({ getToken: async () => { throw { code, message: 'private token' }; } });
    await assert.rejects(f.request('/api/market'), error => error.status === 401 && !error.message.includes('private'));
    assert.equal(f.calls.length, 0);
    assert.equal(f.logouts.length, 1);
  }
});
test('temporary refresh/network/server errors retain the session and never replay', async () => {
  const refresh = fixture({ getToken: async () => { throw { code: 'auth/network-request-failed', message: 'private token' }; } });
  await assert.rejects(refresh.request('/api/market'), /connection/);
  assert.equal(refresh.logouts.length, 0);
  const network = fixture({ send: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(network.request('/api/market'));
  assert.equal(network.calls.length, 1);
  assert.equal(network.logouts.length, 0);
  for (const status of [403, 429, 500]) {
    const f = fixture({ send: async () => new Response('', { status }) });
    assert.equal((await f.request('/api/market')).status, status);
    assert.equal(f.calls.length, 1);
    assert.equal(f.logouts.length, 0);
  }
});
