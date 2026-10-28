import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Firestore } from '@google-cloud/firestore';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { firestoreRest } from '../lib/operations/rest.mjs';
const require = createRequire(import.meta.url);
export async function maintenanceServices(projectId) {
  if (!['demo-quadmart', 'quadmart-development'].includes(projectId)) throw new Error('Explicit demo/development project required');
  const local = projectId === 'demo-quadmart';
  if (local) {
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Both loopback emulators required');
    const app = initializeApp({ projectId }, 'quadmart-maintenance');
    const db = getFirestore(app);
    return { db, auth: getAuth(app), snapshotRequest: firestoreRest({ projectId, endpoint: 'http://127.0.0.1:8080' }), close: async () => { await db.terminate(); await deleteApp(app); } };
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Unexpected emulator variables');
  // Uses the operator's existing firebase login. Never grant these privileges to
  // the preview runtime or copy a refresh token into an environment variable.
  const configPath = process.env.QUADMART_FIREBASE_CLI_CONFIG ?? path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'configstore/firebase-tools.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  if (!config.tokens?.refresh_token || !config.tokens?.scopes) throw new Error('Sign in with the Firebase CLI first');
  const { getAccessToken } = require('firebase-tools/lib/auth.js');
  const fresh = () => getAccessToken(config.tokens.refresh_token, config.tokens.scopes);
  const token = await fresh(), client = new OAuth2Client();
  client.setCredentials({ access_token: token.access_token, expiry_date: token.expires_at });
  const db = new Firestore({ projectId, auth: new GoogleAuth({ projectId, authClient: client }) });
  const app = initializeApp({ projectId, credential: { getAccessToken: async () => { const t = await fresh(); return { access_token: t.access_token, expires_in: Math.floor((t.expires_at - Date.now()) / 1000) }; } } }, 'quadmart-maintenance');
  const authConfiguration = async () => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`, { headers: { Authorization: `Bearer ${(await fresh()).access_token}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Auth backup configuration could not be read');
    return response.json();
  };
  return { db, auth: getAuth(app), authConfiguration, snapshotRequest: firestoreRest({ projectId, accessToken: async () => (await fresh()).access_token }), close: async () => { await db.terminate(); await deleteApp(app); } };
}
