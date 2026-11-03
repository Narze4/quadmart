import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_TARGETS, previewTarget, validateCloudDeployment } from '../lib/cloud-targets.mjs';
import { federationOptions } from '../lib/server/federation.mjs';
import { appCheckConfig } from '../lib/app-check-config.mjs';
import { betaAccessAllowed } from '../lib/beta-access.mjs';

const beta = {
  VERCEL_ENV: 'preview', QUADMART_DEPLOYMENT_TARGET: 'beta', QUADMART_CREDENTIAL_MODE: 'vercel-oidc',
  VERCEL_PROJECT_ID: CLOUD_TARGETS['quadmart-beta'].vercelProjectId,
  FIREBASE_ADMIN_PROJECT_ID: 'quadmart-beta', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quadmart-beta',
  GCP_WORKLOAD_IDENTITY_PROVIDER: CLOUD_TARGETS['quadmart-beta'].provider,
  GCP_SERVICE_ACCOUNT_EMAIL: CLOUD_TARGETS['quadmart-beta'].serviceAccount,
  NEXT_PUBLIC_FIREBASE_APP_ID: CLOUD_TARGETS['quadmart-beta'].appId,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'quadmart-beta.firebaseapp.com',
  NEXT_PUBLIC_ENABLE_APP_CHECK: 'true', NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY: 'synthetic-public-beta-site-key',
};
test('beta resolves only its independent preview identity and registered app', () => {
  assert.equal(previewTarget(beta).projectId, 'quadmart-beta');
  assert.equal(validateCloudDeployment(beta).name, 'beta');
  const options = federationOptions(beta);
  assert.equal(options.audience, '//iam.googleapis.com/' + CLOUD_TARGETS['quadmart-beta'].provider);
  assert(options.service_account_impersonation_url.includes('quadmart-beta-preview@quadmart-beta.iam.gserviceaccount.com'));
});
test('mixed project, app, identity, environment and missing attestation configurations fail closed', () => {
  for (const override of [
    { VERCEL_PROJECT_ID: undefined }, { VERCEL_PROJECT_ID: 'another-project' },
    { VERCEL_ENV: 'production' }, { VERCEL_ENV: undefined }, { QUADMART_DEPLOYMENT_TARGET: undefined },
    { FIREBASE_ADMIN_PROJECT_ID: 'quadmart-development' }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quadmart-development' },
    { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quadmart-4410f' }, { QUADMART_CREDENTIAL_MODE: 'adc' },
    { GCP_WORKLOAD_IDENTITY_PROVIDER: CLOUD_TARGETS['quadmart-development'].provider },
    { GCP_SERVICE_ACCOUNT_EMAIL: CLOUD_TARGETS['quadmart-development'].serviceAccount },
    { NEXT_PUBLIC_FIREBASE_APP_ID: 'another-app' }, { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'quadmart-development.firebaseapp.com' },
    { NEXT_PUBLIC_ENABLE_APP_CHECK: 'false' }, { NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY: '' },
    { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
    { QUADMART_LOCAL: 'true' }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true' },
  ]) assert.throws(() => validateCloudDeployment({ ...beta, ...override }));
});
test('development retains its original identity and never accepts beta credentials', () => {
  const dev = { VERCEL_ENV: 'preview', FIREBASE_ADMIN_PROJECT_ID: 'quadmart-development', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quadmart-development',
    QUADMART_CREDENTIAL_MODE: 'vercel-oidc', GCP_WORKLOAD_IDENTITY_PROVIDER: CLOUD_TARGETS['quadmart-development'].provider,
    GCP_SERVICE_ACCOUNT_EMAIL: CLOUD_TARGETS['quadmart-development'].serviceAccount };
  assert.equal(validateCloudDeployment(dev).name, 'development');
  assert.throws(() => validateCloudDeployment({ ...dev, QUADMART_DEPLOYMENT_TARGET: 'beta' }));
  assert.throws(() => validateCloudDeployment({ ...dev, GCP_SERVICE_ACCOUNT_EMAIL: beta.GCP_SERVICE_ACCOUNT_EMAIL }));
  assert.throws(() => validateCloudDeployment({ ...dev, VERCEL_PROJECT_ID: beta.VERCEL_PROJECT_ID }));
});
test('hosted beta App Check cannot be disabled; local emulators never attest', () => {
  const config = { projectId: 'quadmart-beta', browser: true, emulators: false, enabled: 'true', siteKey: beta.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY };
  assert.equal(appCheckConfig(config).isTokenAutoRefreshEnabled, true);
  for (const enabled of [undefined, '', 'false']) assert.throws(() => appCheckConfig({ ...config, enabled }));
  assert.equal(appCheckConfig({ ...config, emulators: true, enabled: 'false' }), null);
  assert.equal(appCheckConfig({ ...config, browser: false }), null);
});
test('a missing policy never opens the beta client while development keeps its compatibility default', () => {
  assert.equal(betaAccessAllowed(null, { active: true, campusId: 'emory.edu' }, 'emory.edu', 'quadmart-beta'), false);
  assert.equal(betaAccessAllowed(null, null, 'emory.edu', 'quadmart-development'), true);
  assert.equal(betaAccessAllowed({ mode: 'invite-only', campusId: 'emory.edu' }, { active: true, campusId: 'emory.edu' }, 'emory.edu', 'quadmart-beta'), true);
});
