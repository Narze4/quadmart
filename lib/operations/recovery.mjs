import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { digest, rootName, privateDirectory } from './backup.mjs';
import { validateAccounts, validateHashConfig, validateRecovery, requireValid, sha256, expectedPublicId, MAX_RECOVERY_PHOTO_BYTES, MAX_RECOVERY_TOTAL_BYTES } from './recovery-schema.mjs';

export async function captureAccounts(auth) {
  const accounts = []; let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      requireValid(!user.tenantId && !user.multiFactor?.enrolledFactors?.length, 'Tenant or MFA recovery is not configured');
      const value = { uid: user.uid, email: user.email, emailVerified: user.emailVerified, disabled: user.disabled, providerData: user.providerData, passwordHash: user.passwordHash, passwordSalt: user.passwordSalt, metadata: { creationTime: user.metadata.creationTime, lastSignInTime: user.metadata.lastSignInTime } };
      for (const field of ['displayName', 'photoURL', 'phoneNumber', 'customClaims']) if (user[field] !== undefined) value[field] = user[field];
      accounts.push(value); requireValid(accounts.length <= 10000, 'Account backup bound exceeded');
    }
    requireValid(!page.pageToken || page.pageToken !== pageToken, 'Repeated account page'); pageToken = page.pageToken;
  } while (pageToken);
  accounts.sort((a,b) => a.uid.localeCompare(b.uid)); validateAccounts(accounts); return accounts;
}
const field = (doc, name) => doc.fields?.[name]?.stringValue;
export async function addRecovery(snapshot, { auth, authConfiguration, downloadPhoto }) {
  const startedAt = new Date().toISOString(), configuration = await authConfiguration();
  const hashConfig = configuration.signIn?.hashConfig; validateHashConfig(hashConfig);
  const accounts = await captureAccounts(auth), photos = [], skipped = [];
  const prefix = `${rootName(snapshot.projectId)}/media/`; let total = 0;
  for (const doc of snapshot.documents.filter(d => d.name.startsWith(prefix) && !d.name.slice(prefix.length).includes('/'))) {
    const mediaId = doc.name.slice(prefix.length), ownerUid = field(doc, 'ownerUid'), status = field(doc, 'status');
    if (status === 'deleted') continue;
    requireValid(['ready', 'blocked', 'deleting', 'pending', 'failed'].includes(status), 'Unknown media registry state');
    const publicId = expectedPublicId(snapshot.projectId, ownerUid, mediaId);
    requireValid(field(doc, 'publicId') === publicId, 'Media registry escaped development namespace');
    const result = await downloadPhoto(publicId);
    if (result.missing && ['pending', 'failed'].includes(status)) { skipped.push({ mediaId, reason: 'unfinished_upload_missing_at_provider' }); continue; }
    requireValid(!result.missing && Buffer.isBuffer(result.bytes) && result.bytes.length > 0 && result.bytes.length <= MAX_RECOVERY_PHOTO_BYTES, 'Required photo could not be backed up');
    const meta = await sharp(result.bytes, { limitInputPixels: 25000000, failOn: 'warning' }).metadata();
    requireValid(meta.format === 'jpeg' && (meta.pages ?? 1) === 1, 'Stored photo format changed');
    total += result.bytes.length; requireValid(total <= MAX_RECOVERY_TOTAL_BYTES && photos.length < 1000, 'Photo backup bound exceeded');
    photos.push({ mediaId, ownerUid, publicId, format: 'jpg', deliveryType: 'authenticated', byteLength: result.bytes.length, width: meta.width, height: meta.height, sha256: sha256(result.bytes), bytes: result.bytes.toString('base64') });
  }
  // Auth is not a Firestore transaction. Detect changes during photo capture
  // rather than silently combining differing account lists/credentials.
  requireValid(digest(accounts) === digest(await captureAccounts(auth)), 'Accounts changed during backup; retry capture');
  requireValid(digest(hashConfig) === digest((await authConfiguration()).signIn?.hashConfig), 'Password hash parameters changed during backup');
  const recovery = { version: 1, startedAt, completedAt: new Date().toISOString(), auth: { projectId: snapshot.projectId, accountCount: accounts.length, hashConfig, accounts }, photoCount: photos.length, photoBytes: total, photos, skipped };
  validateRecovery(recovery, snapshot.projectId);
  return { ...snapshot, version: 2, recovery, recoveryChecksum: digest(recovery), excludes: ['IAM and platform configuration', 'Non-password providers, tenant and MFA configuration', 'Active sessions/refresh tokens', 'Unregistered Cloudinary assets'] };
}
export function importHashOptions(hash) {
  validateHashConfig(hash);
  return { hash: { algorithm: 'SCRYPT', key: Buffer.from(hash.signerKey, 'base64'), saltSeparator: Buffer.from(hash.saltSeparator, 'base64'), rounds: hash.rounds, memoryCost: hash.memoryCost } };
}
export function importAccount(user, { quarantine = true } = {}) {
  return { ...user, disabled: quarantine ? true : user.disabled, passwordHash: Buffer.from(user.passwordHash, 'base64'), passwordSalt: Buffer.from(user.passwordSalt, 'base64'), providerData: [] };
}
export async function restoreAccountsLocally(recovery) {
  requireValid(process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9199' && process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8180', 'Both isolated restore emulators required');
  const app = initializeApp({ projectId: 'demo-quadmart-restore' }, 'quadmart-auth-restore');
  try {
    const auth = getAuth(app);
    requireValid((await auth.listUsers(1)).users.length === 0, 'Auth restore target must be empty');
    for (let i = 0; i < recovery.auth.accounts.length; i += 100) {
      const result = await auth.importUsers(recovery.auth.accounts.slice(i, i+100).map(u => importAccount(u)), importHashOptions(recovery.auth.hashConfig));
      requireValid(result.failureCount === 0, 'Account import failed');
    }
    const restored = await captureAccounts(auth);
    requireValid(restored.length === recovery.auth.accounts.length, 'Restored account count mismatch');
    for (const source of recovery.auth.accounts) {
      const actual = restored.find(u => u.uid === source.uid);
      requireValid(actual?.disabled === true && actual.email === source.email && actual.emailVerified === source.emailVerified && actual.passwordHash === source.passwordHash && actual.passwordSalt === source.passwordSalt && digest(actual.customClaims ?? {}) === digest(source.customClaims ?? {}), 'Restored account verification failed');
      for (const field of ['displayName', 'photoURL', 'phoneNumber']) requireValid(actual[field] === source[field], 'Restored account profile mismatch');
      requireValid(actual.metadata.creationTime === source.metadata.creationTime, 'Restored account creation time mismatch');
    }
    return { restoredAccounts: restored.length, accountsQuarantined: true, passwordLoginTested: false };
  } finally { await deleteApp(app); }
}
export async function restorePhotosLocally(recovery, directory) {
  await privateDirectory(directory); requireValid((await fs.readdir(directory)).length === 0, 'Photo restore directory must be empty');
  for (const photo of recovery.photos) {
    requireValid(/^[a-f0-9]{64}$/.test(photo.mediaId), 'Invalid restored photo identifier');
    const filename = path.join(directory, `${photo.mediaId}.jpg`), bytes = Buffer.from(photo.bytes, 'base64');
    requireValid(sha256(bytes) === photo.sha256, 'Corrupt restored photo');
    await fs.writeFile(filename, bytes, { flag: 'wx', mode: 0o600 });
    const actual = await fs.readFile(filename), meta = await sharp(actual, { limitInputPixels: 25000000 }).metadata();
    requireValid(sha256(actual) === photo.sha256 && meta.width === photo.width && meta.height === photo.height && meta.format === 'jpeg', 'Restored photo verification failed');
  }
  return { restoredPhotos: recovery.photos.length, photoBytesVerified: recovery.photoBytes };
}
