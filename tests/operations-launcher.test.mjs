import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const launchers = ['run-scheduled-maintenance.mjs', 'run-scheduled-restore.mjs'];
test('scheduled launchers reject a changed source manifest and produce safe failure reports', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quadmart-launcher-'));
  try {
    await fs.mkdir(path.join(dir, 'runtime'));
    await fs.writeFile(path.join(dir, 'runtime/code.mjs'), 'throw new Error("should never execute")');
    await fs.writeFile(path.join(dir, 'runtime-manifest.json'), JSON.stringify({ 'code.mjs': 'wrong-digest' }));
    await fs.writeFile(path.join(dir, 'local-config.json'), JSON.stringify({ projectId: 'quadmart-development', cloudinaryConfig: '/private/not-read' }));
    for (const name of launchers) {
      const child = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${name}`, import.meta.url)), dir], { encoding: 'utf8' });
      assert.equal(child.status, 1); assert(!child.stdout.includes('should never execute')); assert(!child.stdout.includes('/private/not-read'));
      const result = JSON.parse(child.stdout); assert.equal(result.result?.status ?? result.status, 'failed');
    }
  } finally { await fs.rm(dir, { recursive: true }); }
});
test('scheduled launchers refuse symlink directories without writing through them', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quadmart-launcher-link-'));
  try {
    const target = path.join(dir, 'target'), link = path.join(dir, 'link'); await fs.mkdir(target, { mode: 0o700 }); await fs.symlink(target, link);
    for (const name of launchers) {
      const child = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${name}`, import.meta.url)), link], { encoding: 'utf8' }); assert.equal(child.status, 1);
    }
    assert.deepEqual(await fs.readdir(target), []);
  } finally { await fs.rm(dir, { recursive: true }); }
});
