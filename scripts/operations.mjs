import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { maintenanceServices } from './maintenance-services.mjs';
import { runMaintenance } from '../lib/operations/worker.mjs';
import { captureSnapshot, privateDirectory, backupKey, saveBackup, pruneBackups, unseal, restoreSnapshot } from '../lib/operations/backup.mjs';
import { firestoreRest } from '../lib/operations/rest.mjs';
import { addRecovery, restoreAccountsLocally, restorePhotosLocally } from '../lib/operations/recovery.mjs';
import { photoDownloader } from '../lib/operations/photo-download.mjs';
import { sha256 } from '../lib/operations/recovery-schema.mjs';
import { registerOffsite, preparedBackup } from '../lib/operations/offsite.mjs';

const { values } = parseArgs({ options: { project: { type: 'string' }, action: { type: 'string', default: 'run' }, directory: { type: 'string' }, key: { type: 'string' }, file: { type: 'string' }, 'cloudinary-config': { type: 'string' }, 'offsite-config': { type: 'string' }, download: { type: 'string' }, metadata: { type: 'string' }, apply: { type: 'boolean', default: false } } });
let services, result;
try {
  if (!['run', 'backup', 'status', 'restore-test', 'register-offsite', 'offsite-status'].includes(values.action) || !values.directory || !values.key) throw new Error('Explicit action, directory and key required');
  await privateDirectory(values.directory);
  const key = await backupKey(values.key);
  const reportPath = path.join(values.directory, 'latest-run.json');
  const offsite = values['offsite-config'] ? JSON.parse(await fs.readFile(values['offsite-config'], 'utf8')) : null;
  if (values.action === 'offsite-status') {
    result = JSON.parse(await fs.readFile(path.join(values.directory, 'latest-offsite.json'), 'utf8'));
    result.overdue = Date.now() - Date.parse(result.verifiedAt) > 18 * 3600000;
  } else if (values.action === 'register-offsite') {
    if (!offsite?.folderId || !offsite.ownerEmail || !values.metadata || !values.download) throw new Error('Private offsite metadata/configuration required');
    result = await registerOffsite({ directory: values.directory, filename: values.file, downloadedFile: values.download, metadata: JSON.parse(await fs.readFile(values.metadata, 'utf8')), folderId: offsite.folderId, ownerEmail: offsite.ownerEmail, key });
  } else if (values.action === 'status') {
    const last = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    result = { ...last, overdue: Date.now() - Date.parse(last.finishedAt) > 18 * 60 * 60 * 1000 };
  } else if (values.action === 'restore-test') {
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180' || values.project !== 'demo-quadmart-restore') throw new Error('Isolated restore emulator required');
    if (!values.file || path.basename(values.file) !== values.file || !values.file.endsWith('.qmb')) throw new Error('Backup filename required');
    const snapshot = unseal(await fs.readFile(path.join(values.directory, values.file), 'utf8'), key);
    result = await restoreSnapshot(snapshot, { projectId: values.project, endpoint: 'http://127.0.0.1:8180', request: firestoreRest({ projectId: values.project, endpoint: 'http://127.0.0.1:8180' }) });
    if (snapshot.version === 2) {
      const authResult = await restoreAccountsLocally(snapshot.recovery);
      const photoDirectory = await fs.mkdtemp(path.join(values.directory, 'restore-photos-'));
      try { result = { ...result, ...authResult, ...await restorePhotosLocally(snapshot.recovery, photoDirectory) }; }
      finally { await fs.rm(photoDirectory, { recursive: true, force: true }); }
    }
    result = { ...result, source: snapshot.projectId, sourceReadTime: snapshot.readTime, sourceChecksum: snapshot.checksum, finishedAt: new Date().toISOString() };
    await fs.writeFile(path.join(values.directory, 'latest-restore.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  } else {
    services = await maintenanceServices(values.project);
    let saved, storage;
    if (values.project === 'quadmart-development') {
      if (!values['cloudinary-config']) throw new Error('Restricted development storage configuration required');
      const stat = await fs.lstat(values['cloudinary-config']);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private storage configuration required');
      storage = JSON.parse(await fs.readFile(values['cloudinary-config'], 'utf8'));
      if (storage.cloud_name !== 'digi5pklj' || !storage.api_key || !storage.api_secret) throw new Error('Unexpected storage account');
    }
    const backup = async () => {
      if (values.apply && values.project === 'quadmart-development') {
        if (!offsite?.folderId) throw new Error('Offsite destination required');
        saved = await preparedBackup({ directory: values.directory, filename: values.file, folderId: offsite.folderId, key }); return saved;
      }
      const configuration = {};
      for (const name of ['firestore.rules', 'firestore.indexes.json', 'firebase.json']) configuration[name] = await fs.readFile(new URL(`../${name}`, import.meta.url), 'utf8');
      let snapshot = await captureSnapshot(services.snapshotRequest, values.project, { configuration });
      if (values.project === 'quadmart-development') snapshot = await addRecovery(snapshot, { ...services, downloadPhoto: photoDownloader(storage) });
      saved = await saveBackup(values.directory, snapshot, key);
      await pruneBackups(values.directory);
      const encrypted = await fs.readFile(path.join(values.directory, saved.filename));
      saved = { ...saved, file: path.join(values.directory, saved.filename), sha256: sha256(encrypted), bytes: encrypted.length };
      return { ...saved, verified: true };
    };
    if (values.action === 'backup') result = { status: 'success', projectId: values.project, backup: await backup() };
    else {
      if (values.apply && values.project !== 'quadmart-development') throw new Error('CLI apply is restricted to development');
      const destroyImage = id => cloudinary.uploader.destroy(id, { ...storage, resource_type: 'image', type: 'authenticated', invalidate: true, timeout: 15000 });
      result = await runMaintenance({ ...services, projectId: values.project, backup, destroyImage, apply: values.apply });
      result.finishedAt = new Date().toISOString();
      if (saved) result.backupFile = saved.filename;
      const temp = `${reportPath}.partial`;
      await fs.writeFile(temp, JSON.stringify(result, null, 2), { mode: 0o600 }); await fs.rename(temp, reportPath);
    }
  }
  console.log(JSON.stringify(result));
  if (['failed', 'attention'].includes(result.status) || result.overdue) process.exitCode = 1;
} catch {
  // Exception bodies can contain private document data or provider credentials.
  console.error(JSON.stringify({ status: 'failed', action: values.action, message: 'Development operations did not complete. Check configuration, private files, services and the last safe report; no raw error body is logged.' }));
  process.exitCode = 1;
} finally { await services?.close(); }
