import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// This launcher imports only Node builtins. Its private runtime is a reviewed
// source/dependency copy, independent of an unfinished application checkout.
const home = process.argv[2];
let report, privateHome = false;
try {
  if (!home || !path.isAbsolute(home)) throw new Error('Absolute operations directory required');
  const stat = await fs.lstat(home);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private operations directory required');
  privateHome = true;
  const config = JSON.parse(await fs.readFile(path.join(home, 'local-config.json'), 'utf8'));
  if (config.projectId !== 'quadmart-development' || !path.isAbsolute(config.cloudinaryConfig)) throw new Error('Development configuration required');
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Unexpected emulator configuration');
  const runtime = path.join(home, 'runtime');
  const manifest = JSON.parse(await fs.readFile(path.join(home, 'runtime-manifest.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest)) {
    if (name.includes('..') || path.isAbsolute(name)) throw new Error('Invalid runtime manifest');
    const actual = createHash('sha256').update(await fs.readFile(path.join(runtime, name))).digest('hex');
    if (actual !== expected) throw new Error('Operations runtime changed; review and refresh required');
  }
  const startedAt = new Date().toISOString();
  const child = spawnSync(process.execPath, [path.join(runtime, 'scripts/operations.mjs'), '--project', 'quadmart-development', '--action', 'run', '--apply', '--directory', path.join(home, 'backups'), '--key', path.join(home, 'backup.key'), '--cloudinary-config', config.cloudinaryConfig], {
    cwd: runtime, env: { ...process.env, XDG_CONFIG_HOME: path.join(home, 'firebase-config') }, timeout: 8 * 60 * 1000, maxBuffer: 1024 * 1024, encoding: 'utf8'
  });
  // Read the worker's explicit safe projection. Do not emit SDK stderr or raw
  // exception bodies from a failed dependency/configuration load.
  const lines = (child.stdout ?? '').trim().split('\n');
  let result;
  try { result = JSON.parse(lines.at(-1)); } catch { result = { status: 'failed', failedStage: 'launch' }; }
  report = { startedAt, finishedAt: new Date().toISOString(), exitCode: child.status ?? 1, timedOut: child.error?.code === 'ETIMEDOUT', result };
  if (report.exitCode !== 0) process.exitCode = 1;
} catch {
  report = { finishedAt: new Date().toISOString(), exitCode: 1, result: { status: 'failed', failedStage: 'configuration_or_runtime' } }; process.exitCode = 1;
}
if (privateHome) {
  try {
    const file = path.join(home, 'latest-launch.json');
    await fs.writeFile(`${file}.partial`, JSON.stringify(report, null, 2), { mode: 0o600 }); await fs.rename(`${file}.partial`, file);
  } catch { process.exitCode = 1; }
}
console.log(JSON.stringify(report));
