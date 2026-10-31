import fs from 'node:fs/promises';
import path from 'node:path';
import { unseal, privateDirectory } from './backup.mjs';
import { requireValid, sha256 } from './recovery-schema.mjs';

export const backupFilename = name => typeof name === 'string' && /^quadmart-[0-9T-]+Z-[a-f0-9-]{36}\.qmb$/.test(name);
export async function registerOffsite({ directory, filename, downloadedFile, metadata, folderId, ownerEmail, key, now = Date.now() }) {
  requireValid(backupFilename(filename) && path.isAbsolute(downloadedFile), 'Explicit backup/download required');
  const original = await fs.readFile(path.join(directory, filename)), downloaded = await fs.readFile(downloadedFile);
  const checksum = sha256(original);
  requireValid(checksum === sha256(downloaded), 'Offsite downloaded bytes do not match');
  requireValid(metadata?.id && metadata.title === filename && metadata.mime_type === 'application/octet-stream' && Number(metadata.size) === downloaded.length && metadata.parent_ids?.length === 1 && metadata.parent_ids[0] === folderId && metadata.shared === false, 'Offsite file metadata mismatch');
  requireValid(metadata.permissions?.length === 1 && metadata.permissions[0].type === 'user' && metadata.permissions[0].role === 'owner' && metadata.permissions[0].emailAddress?.toLowerCase() === ownerEmail.toLowerCase(), 'Offsite file must remain owner-only');
  const snapshot = unseal(downloaded.toString('utf8'), key);
  requireValid(snapshot.projectId === 'quadmart-development' && snapshot.version === 2, 'Complete development recovery bundle required');
  const receipt = { version: 1, filename, projectId: snapshot.projectId, fileId: metadata.id, folderId, ownerOnly: true, sha256: checksum, bytes: downloaded.length, verifiedAt: new Date(now).toISOString(), capturedAt: snapshot.capturedAt, documentCount: snapshot.documentCount, accountCount: snapshot.recovery.auth.accountCount, photoCount: snapshot.recovery.photoCount, recoveryChecksum: snapshot.recoveryChecksum };
  const receipts = path.join(directory, 'offsite-receipts'); await privateDirectory(receipts);
  const target = path.join(receipts, `${checksum}.json`);
  await fs.writeFile(`${target}.partial`, JSON.stringify(receipt, null, 2), { mode: 0o600 }); await fs.rename(`${target}.partial`, target);
  const latest = path.join(directory, 'latest-offsite.json');
  await fs.writeFile(`${latest}.partial`, JSON.stringify(receipt, null, 2), { mode: 0o600 }); await fs.rename(`${latest}.partial`, latest);
  return receipt;
}
export async function preparedBackup({ directory, filename, folderId, key, now = Date.now() }) {
  requireValid(backupFilename(filename), 'Explicit prepared backup required');
  const encrypted = await fs.readFile(path.join(directory, filename)), checksum = sha256(encrypted);
  const receipt = JSON.parse(await fs.readFile(path.join(directory, 'offsite-receipts', `${checksum}.json`), 'utf8'));
  const snapshot = unseal(encrypted.toString('utf8'), key);
  requireValid(snapshot.projectId === 'quadmart-development' && snapshot.version === 2 && receipt.projectId === snapshot.projectId && receipt.filename === filename && receipt.sha256 === checksum && receipt.folderId === folderId && receipt.ownerOnly === true && receipt.recoveryChecksum === snapshot.recoveryChecksum, 'Verified offsite receipt required');
  for (const time of [snapshot.capturedAt, receipt.verifiedAt]) requireValid(Number.isFinite(Date.parse(time)) && now - Date.parse(time) <= 30 * 60000 && now >= Date.parse(time) - 60000, 'Prepared backup or receipt is stale');
  return { filename, verified: true, offsiteVerified: true, documentCount: snapshot.documentCount, readTime: snapshot.readTime, accountCount: snapshot.recovery.auth.accountCount, photoCount: snapshot.recovery.photoCount, fullRecovery: true };
}
