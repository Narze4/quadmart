import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export function backend() {
  const local=process.env.QUADMART_LOCAL==='true';
  if(local && (process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')) throw new Error('Local backend requires both loopback emulators');
  if(!local && (process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error('Unexpected emulator configuration');
  const projectId=local?'demo-quadmart':process.env.FIREBASE_ADMIN_PROJECT_ID;
  if(!projectId || (!local && projectId!==process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) throw new Error('Backend and browser project IDs must match');
  const app=getApps().find(a=>a.name==='quadmart-server') ?? initializeApp({projectId,...(local?{}:{credential:applicationDefault()})},'quadmart-server');
  return {auth:getAuth(app),db:getFirestore(app)};
}
