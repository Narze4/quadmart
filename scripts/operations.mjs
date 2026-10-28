import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { maintenanceServices } from './maintenance-services.mjs';
import { runMaintenance } from '../lib/operations/worker.mjs';
import { captureSnapshot, privateDirectory, backupKey, saveBackup, pruneBackups, unseal, restoreSnapshot } from '../lib/operations/backup.mjs';
import { firestoreRest } from '../lib/operations/rest.mjs';

const { values } = parseArgs({ options: { project: { type: 'string' }, action: { type: 'string', default: 'run' }, directory: { type: 'string' }, key: { type: 'string' }, file: { type: 'string' }, 'cloudinary-config': { type: 'string' }, apply: { type: 'boolean', default: false } } });
let services, result;
try {
  if (!['run', 'backup', 'status', 'restore-test'].includes(values.action) || !values.directory || !values.key) throw new Error('Explicit action, directory and key required');
  await privateDirectory(values.directory);
  const key = await backupKey(values.key, { create: values.action !== 'restore-test' && values.action !== 'status' });
  const reportPath = path.join(values.directory, 'latest-run.json');
  if (values.action === 'status') {
    const last = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    result = { ...last, overdue: Date.now() - Date.parse(last.finishedAt) > 18 * 60 * 60 * 1000 };
  } else if (values.action === 'restore-test') {
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180' || values.project !== 'demo-quadmart-restore') throw new Error('Isolated restore emulator required');
    if (!values.file || path.basename(values.file) !== values.file || !values.file.endsWith('.qmb')) throw new Error('Backup filename required');
    const snapshot = unseal(await fs.readFile(path.join(values.directory, values.file), 'utf8'), key);
    result = await restoreSnapshot(snapshot, { projectId: values.project, endpoint: 'http://127.0.0.1:8180', request: firestoreRest({ projectId: values.project, endpoint: 'http://127.0.0.1:8180' }) });
    result = { ...result, source: snapshot.projectId, sourceReadTime: snapshot.readTime, sourceChecksum: snapshot.checksum, finishedAt: new Date().toISOString() };
    await fs.writeFile(path.join(values.directory, 'latest-restore.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  } else {
    services = await maintenanceServices(values.project);
    let saved;
    const backup = async () => {
      const configuration = {};
      for (const name of ['firestore.rules', 'firestore.indexes.json', 'firebase.json']) configuration[name] = await fs.readFile(new URL(`../${name}`, import.meta.url), 'utf8');
      const snapshot = await captureSnapshot(services.snapshotRequest, values.project, { configuration });
      saved = await saveBackup(values.directory, snapshot, key);
      await pruneBackups(values.directory);
      return { ...saved, verified: true };
    };
    if (values.action === 'backup') result = { status: 'success', projectId: values.project, backup: await backup() };
    else {
      let storage;
      if (values.apply) {
        if (values.project !== 'quadmart-development' || !values['cloudinary-config']) throw new Error('Restricted development storage configuration required');
        const stat = await fs.lstat(values['cloudinary-config']);
        if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private storage configuration required');
        storage = JSON.parse(await fs.readFile(values['cloudinary-config'], 'utf8'));
        if (storage.cloud_name !== 'digi5pklj' || !storage.api_key || !storage.api_secret) throw new Error('Unexpected storage account');
      }
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
