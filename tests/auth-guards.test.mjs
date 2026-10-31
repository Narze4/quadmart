import test from 'node:test';
import assert from 'node:assert/strict';
import { appCheckConfig } from '../lib/app-check-config.mjs';
import { authErrorMessage } from '../lib/auth-errors.mjs';

const enabled = { browser: true, enabled: 'true', projectId: 'quadmart-development', siteKey: 'test-public-site-key-123456' };
test('attestation is isolated from emulator and server rendering', () => {
  assert.equal(appCheckConfig({ ...enabled, emulators: true }), null);
  assert.equal(appCheckConfig({ ...enabled, browser: false }), null);
  assert.equal(appCheckConfig({ ...enabled, enabled: 'false' }), null);
  assert.equal(appCheckConfig({ ...enabled, enabled: undefined }), null);
});
test('enabled attestation fails closed on missing or production configuration', () => {
  for (const siteKey of [undefined, '', ' ', 'invalid<script>']) assert.throws(() => appCheckConfig({ ...enabled, siteKey }));
  assert.throws(() => appCheckConfig({ ...enabled, projectId: 'quadmart-4410f' }));
  assert.deepEqual(appCheckConfig(enabled), { siteKey: enabled.siteKey, isTokenAutoRefreshEnabled: true });
});
test('auth failures never echo SDK diagnostics or identify existing accounts', () => {
  const secret = 'private-token-and-email';
  for (const code of ['auth/email-already-in-use', 'auth/internal-error', 'unexpected']) {
    assert.equal(authErrorMessage({ code, message: secret }), 'Could not create this account. Try logging in or resetting your password.');
  }
  assert.match(authErrorMessage({ code: 'auth/too-many-requests' }), /Wait a few minutes/);
  assert.match(authErrorMessage({ code: 'auth/firebase-app-check-token-is-invalid' }), /security check/);
  assert.match(authErrorMessage({ code: 'auth/password-does-not-meet-requirements' }), /12 characters/);
  assert.match(authErrorMessage({ code: 'auth/network-request-failed' }, 'login'), /connection/);
});

test('live App Check rejection gives security retry guidance for every auth action', () => {
  for (const action of ['signup', 'login', 'reset', 'change-password']) {
    const message = authErrorMessage({ code: 'auth/firebase-app-check-token-is-invalid.', message: 'private diagnostic' }, action);
    assert.equal(message, 'The security check could not finish. Reload this page and try again.');
    assert(!message.includes('password'));
  }
});

test('password-change failures expose actionable policy and sign-in guidance without SDK details', () => {
  for (const code of ['auth/weak-password', 'auth/password-does-not-meet-requirements']) {
    assert.match(authErrorMessage({ code, message: 'private diagnostic' }, 'change-password'), /at least 12 characters/);
  }
  assert.equal(authErrorMessage({ code: 'auth/requires-recent-login' }, 'change-password'), 'Sign in again before changing your password.');
  assert.equal(authErrorMessage({ code: 'unexpected', message: 'private credential' }, 'change-password'), 'Failed to update password. Please try again.');
});
