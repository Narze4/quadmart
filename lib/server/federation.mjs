import { ExternalAccountClient, GoogleAuth } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';
import { getVercelOidcToken } from '@vercel/oidc';

// Only the preview runtime is trusted by this development identity provider.
export function federationOptions(env) {
  if (env.VERCEL_ENV !== 'preview' || env.FIREBASE_ADMIN_PROJECT_ID !== 'quadmart-development') {
    throw new Error('Development federation requires a Vercel preview and quadmart-development');
  }
  const audience = env.GCP_WORKLOAD_IDENTITY_PROVIDER;
  const serviceAccount = env.GCP_SERVICE_ACCOUNT_EMAIL;
  if (audience !== 'projects/377519547132/locations/global/workloadIdentityPools/quadmart-preview/providers/vercel'
    || serviceAccount !== 'quadmart-preview@quadmart-development.iam.gserviceaccount.com') {
    throw new Error('Unexpected development workload identity configuration');
  }
  return {
    type: 'external_account',
    audience: `//iam.googleapis.com/${audience}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  };
}

export function federatedServices(env) {
  const client = ExternalAccountClient.fromJSON(federationOptions(env));
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  return {
    // Firebase Auth accepts its documented Credential interface. Firestore uses
    // the same refreshing Google auth client directly, without a private key.
    credential: {
      async getAccessToken() {
        const { token } = await client.getAccessToken();
        const expiresIn = Math.floor((client.credentials.expiry_date - Date.now()) / 1000);
        if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error('No valid federated credential');
        return { access_token: token, expires_in: expiresIn };
      },
    },
    db: new Firestore({ projectId, auth: new GoogleAuth({ projectId, authClient: client }) }),
  };
}
