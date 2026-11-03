// Explicit, independent deployment identities. These are public identifiers,
// not credentials. Never select a project from a request or a fallback value.
export const CLOUD_TARGETS = Object.freeze({
  'quadmart-development': Object.freeze({
    name: 'development', projectNumber: '377519547132',
    provider: 'projects/377519547132/locations/global/workloadIdentityPools/quadmart-preview/providers/vercel',
    serviceAccount: 'quadmart-preview@quadmart-development.iam.gserviceaccount.com',
  }),
  'quadmart-beta': Object.freeze({
    name: 'beta', projectNumber: '851588712518',
    provider: 'projects/851588712518/locations/global/workloadIdentityPools/quadmart-beta-preview/providers/vercel',
    serviceAccount: 'quadmart-beta-preview@quadmart-beta.iam.gserviceaccount.com',
    appId: '1:851588712518:web:8f0c91bc4d004b5d8b6247',
    vercelProjectId: 'prj_CV5KIH2rwT2Rs67MOrFpzyNL1mwS',
  }),
});

export function previewTarget(env) {
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  const target = CLOUD_TARGETS[projectId];
  if (env.VERCEL_ENV !== 'preview' || !target) throw Error('An isolated preview target is required');
  if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== projectId) throw Error('Backend and browser project IDs must match');
  if (env.QUADMART_CREDENTIAL_MODE !== 'vercel-oidc') throw Error('Preview requires a federated server identity');
  if ((env.QUADMART_DEPLOYMENT_TARGET ?? 'development') !== target.name) throw Error('Unexpected deployment target');
  if (env.GCP_WORKLOAD_IDENTITY_PROVIDER !== target.provider || env.GCP_SERVICE_ACCOUNT_EMAIL !== target.serviceAccount) throw Error('Unexpected workload identity configuration');
  if (target.name === 'beta' && (
    env.VERCEL_PROJECT_ID !== target.vercelProjectId ||
    env.NEXT_PUBLIC_FIREBASE_APP_ID !== target.appId ||
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== 'quadmart-beta.firebaseapp.com' ||
    env.NEXT_PUBLIC_ENABLE_APP_CHECK !== 'true' ||
    !/^[A-Za-z0-9_-]{20,200}$/.test(env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ?? '')
  )) throw Error('Beta requires its registered app and App Check configuration');
  return { ...target, projectId };
}

export function validateCloudDeployment(env) {
  if (env.VERCEL_PROJECT_ID === CLOUD_TARGETS['quadmart-beta'].vercelProjectId && env.FIREBASE_ADMIN_PROJECT_ID !== 'quadmart-beta') throw Error('Beta hosting may only connect to its beta backend');
  if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' || env.QUADMART_LOCAL === 'true' || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Never use emulator configuration in a cloud deployment');
  if (!env.FIREBASE_ADMIN_PROJECT_ID || env.FIREBASE_ADMIN_PROJECT_ID !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw Error('Backend and browser project IDs must match');
  // Preserve the existing production path; beta always requires its own Preview.
  if (env.VERCEL_ENV === 'preview' || env.FIREBASE_ADMIN_PROJECT_ID === 'quadmart-beta' || env.QUADMART_DEPLOYMENT_TARGET === 'beta') return previewTarget(env);
  return null;
}
