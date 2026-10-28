import test from 'node:test';
import assert from 'node:assert/strict';
import { federationOptions, federatedServices } from '../lib/server/federation.mjs';
const env = {
  VERCEL_ENV: 'preview', FIREBASE_ADMIN_PROJECT_ID: 'quadmart-development',
  GCP_WORKLOAD_IDENTITY_PROVIDER: 'projects/377519547132/locations/global/workloadIdentityPools/quadmart-preview/providers/vercel',
  GCP_SERVICE_ACCOUNT_EMAIL: 'quadmart-preview@quadmart-development.iam.gserviceaccount.com',
};
test('development federation refuses production and unrelated identities', () => {
  for (const override of [
    { VERCEL_ENV: 'production' }, { FIREBASE_ADMIN_PROJECT_ID: 'quadmart-4410f' },
    { GCP_SERVICE_ACCOUNT_EMAIL: 'other@example.com' }, { GCP_WORKLOAD_IDENTITY_PROVIDER: 'other' },
  ]) assert.throws(() => federationOptions({ ...env, ...override }));
});
test('federation initializes Firebase credential and Firestore without a key or network', async () => {
  const services = federatedServices(env);
  assert.equal(typeof services.credential.getAccessToken, 'function');
  assert.equal(services.db.projectId, 'quadmart-development');
  await services.db.terminate();
});
