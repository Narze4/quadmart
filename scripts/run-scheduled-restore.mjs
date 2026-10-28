import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const home = process.argv[2];
let report, privateHome = false;
try {
  if (!home || !path.isAbsolute(home)) throw new Error('Absolute private directory required');
  const stat = await fs.lstat(home);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private directory required');
  privateHome = true;
  const runtime = path.join(home, 'runtime');
  const manifest = JSON.parse(await fs.readFile(path.join(home, 'runtime-manifest.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest)) {
    if (name.includes('..') || path.isAbsolute(name)) throw new Error('Invalid manifest');
    if (createHash('sha256').update(await fs.readFile(path.join(runtime, name))).digest('hex') !== expected) throw new Error('Changed runtime');
  }
  const backups = path.join(home, 'offsite-downloads');
  const receipt = JSON.parse(await fs.readFile(path.join(home, 'backups/latest-offsite.json'), 'utf8'));
  const file = receipt.filename;
  if (!/^quadmart-[0-9T-]+Z-[a-f0-9-]{36}\.qmb$/.test(file ?? '') || Date.now() - Date.parse(receipt.capturedAt) > 18 * 3600000 || !Number.isFinite(Date.parse(receipt.capturedAt))) throw new Error('Fresh offsite backup required');
  const bytes = await fs.readFile(path.join(backups, file));
  if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256 || receipt.ownerOnly !== true) throw new Error('Verified downloaded backup required');
  const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
  const command = [process.execPath, path.join(runtime, 'scripts/operations.mjs'), '--action', 'restore-test', '--project', 'demo-quadmart-restore', '--directory', backups, '--key', path.join(home, 'backup.key'), '--file', file].map(quote).join(' ');
  const startedAt = new Date().toISOString();
  // The CLI must start its OWN empty emulator. An occupied port fails rather
  // than connecting to/clearing an existing database. It shuts down on exit.
  const child = spawnSync(process.execPath, [path.join(runtime, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--config', path.join(runtime, 'firebase.restore.json'), '--only', 'auth,firestore', '--project', 'demo-quadmart-restore', command], {
    cwd: runtime, env: { ...process.env, XDG_CONFIG_HOME: path.join(home, 'firebase-config'), FIREBASE_EMULATORS_PATH: path.join(home, 'emulators') }, timeout: 8 * 60000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8'
  });
  let result;
  for (const line of (child.stdout ?? '').split('\n')) {
    try { const data = JSON.parse(line); if (data.target === 'demo-quadmart-restore' && data.verified === true) result = data; } catch { /* Only emit the worker's safe result. */ }
  }
  report = { startedAt, finishedAt: new Date().toISOString(), status: child.status === 0 && result ? 'success' : 'failed', timedOut: child.error?.code === 'ETIMEDOUT', ...(result ? { result } : { failedStage: 'emulator_or_restore' }) };
  if (report.status !== 'success') process.exitCode = 1;
} catch { report = { finishedAt: new Date().toISOString(), status: 'failed', failedStage: 'configuration_or_backup' }; process.exitCode = 1; }
if (privateHome) {
  try {
    const file = path.join(home, 'latest-rehearsal.json');
    await fs.writeFile(`${file}.partial`, JSON.stringify(report, null, 2), { mode: 0o600 }); await fs.rename(`${file}.partial`, file);
  } catch { process.exitCode = 1; }
}
console.log(JSON.stringify(report));
