import { createHash } from 'node:crypto';
export const MAX_RECOVERY_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_RECOVERY_TOTAL_BYTES = 32 * 1024 * 1024;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const requireValid = (ok, message) => { if (!ok) throw new Error(message); };
const b64 = value => typeof value === 'string' && /^[A-Za-z0-9+/_-]*={0,2}$/.test(value);
export function validateHashConfig(hash) {
  requireValid(hash?.algorithm === 'SCRYPT' && b64(hash.signerKey) && Buffer.from(hash.signerKey, 'base64').length > 0 && b64(hash.saltSeparator) && Number.isInteger(hash.rounds) && hash.rounds >= 1 && hash.rounds <= 8 && Number.isInteger(hash.memoryCost) && hash.memoryCost >= 1 && hash.memoryCost <= 14, 'Supported Firebase password hash parameters required');
}
export function validateAccounts(accounts) {
  requireValid(Array.isArray(accounts) && accounts.length <= 10000, 'Account backup bound exceeded');
  const ids = new Set();
  for (const user of accounts) {
    requireValid(typeof user.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(user.uid) && !ids.has(user.uid), 'Invalid or duplicate account'); ids.add(user.uid);
    requireValid(typeof user.email === 'string' && user.email.includes('@') && typeof user.emailVerified === 'boolean' && typeof user.disabled === 'boolean', 'Invalid account metadata');
    requireValid(b64(user.passwordHash) && Buffer.from(user.passwordHash, 'base64').length > 0 && b64(user.passwordSalt), 'Exportable password hash required for every account');
    requireValid(Array.isArray(user.providerData) && user.providerData.length > 0 && user.providerData.every(p => p.providerId === 'password'), 'Only current email/password accounts are supported');
  }
}
export function expectedPublicId(projectId, ownerUid, mediaId) {
  requireValid(['demo-quadmart', 'quadmart-development'].includes(projectId) && typeof ownerUid === 'string' && ownerUid.length > 0 && /^[a-f0-9]{64}$/.test(mediaId), 'Invalid photo scope');
  return `quadmart/${projectId}/${sha256(ownerUid).slice(0,24)}/${mediaId}`;
}
export function validateRecovery(recovery, projectId) {
  requireValid(recovery?.version === 1 && recovery.auth?.projectId === projectId && Array.isArray(recovery.photos), 'Invalid recovery bundle');
  validateHashConfig(recovery.auth.hashConfig); validateAccounts(recovery.auth.accounts);
  requireValid(recovery.photos.length <= 1000, 'Photo count bound exceeded');
  const ids = new Set(); let total = 0;
  for (const photo of recovery.photos) {
    requireValid(photo.publicId === expectedPublicId(projectId, photo.ownerUid, photo.mediaId) && !ids.has(photo.mediaId), 'Photo escaped backup namespace'); ids.add(photo.mediaId);
    const bytes = Buffer.from(photo.bytes ?? '', 'base64'); total += bytes.length;
    requireValid(photo.format === 'jpg' && photo.deliveryType === 'authenticated' && bytes.length > 0 && bytes.length <= MAX_RECOVERY_PHOTO_BYTES && total <= MAX_RECOVERY_TOTAL_BYTES && bytes.length === photo.byteLength && sha256(bytes) === photo.sha256, 'Photo bytes or checksum invalid');
  }
  requireValid(recovery.auth.accountCount === recovery.auth.accounts.length && recovery.photoCount === recovery.photos.length && recovery.photoBytes === total, 'Recovery counts do not match');
}
