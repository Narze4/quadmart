import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { captureSnapshot, rootName, digest, seal, unseal, validateSnapshot, saveBackup, backupKey, privateDirectory, restoreSnapshot, pruneBackups } from '../lib/operations/backup.mjs';
import { firestoreRest } from '../lib/operations/rest.mjs';
const root = rootName('quadmart-development');
const sample = () => {
  const documents = [{ name: `${root}/users/test`, fields: { email: { stringValue: 'private@example.edu' }, count: { integerValue: '9007199254740993' }, when: { timestampValue: '2026-10-28T01:02:03.123456Z' } } }];
  return { version: 1, kind: 'firestore-documents', projectId: 'quadmart-development', documentCount: 1, documents, checksum: digest(documents) };
};
test('encrypted backup preserves types and authenticates contents; no plaintext identity leaks', () => {
  const key = randomBytes(32), snapshot = sample(), encrypted = seal(snapshot, key);
  assert(!encrypted.includes('private@example.edu')); assert.deepEqual(unseal(encrypted, key), snapshot);
  assert.throws(() => unseal(encrypted, randomBytes(32)));
  const bad = JSON.parse(encrypted); bad.ciphertext = Buffer.from('modified').toString('base64'); assert.throws(() => unseal(JSON.stringify(bad), key));
  const broken = sample(); broken.checksum = 'wrong'; assert.throws(() => seal(broken, key));
});
test('invalid source, outside paths, duplicate documents and count mismatches are rejected', () => {
  for (const alter of [s => { s.projectId = 'quadmart-4410f'; }, s => { s.documents[0].name = rootName('another') + '/users/t'; }, s => { s.documents.push(s.documents[0]); s.documentCount = 2; }, s => { s.documentCount = 0; }]) {
    const s = sample(); alter(s); s.checksum = digest(s.documents); assert.throws(() => validateSnapshot(s));
  }
});
test('snapshot paginates collections/documents at one read time and traverses missing parents', async () => {
  const requests = [];
  const request = async (method, resource, params) => {
    requests.push({ method, resource, params });
    if (resource === `${root}:listCollectionIds`) return params.pageToken ? { collectionIds: ['empty'] } : { collectionIds: ['parents'], nextPageToken: 'collections2' };
    if (resource === `${root}/parents`) return params.pageToken ? { documents: [{ name: `${root}/parents/real`, createTime: 'now', fields: {} }] } : { documents: [{ name: `${root}/parents/missing` }], nextPageToken: 'docs2' };
    if (resource === `${root}/parents/missing:listCollectionIds`) return { collectionIds: ['children'] };
    if (resource === `${root}/parents/missing/children`) return { documents: [{ name: `${root}/parents/missing/children/kept`, createTime: 'now', fields: { a: { stringValue: 'retained' } } }] };
    return {};
  };
  const s = await captureSnapshot(request, 'quadmart-development');
  assert.equal(s.documentCount, 2); assert(s.documents.some(d => d.name.endsWith('/children/kept')));
  assert(!s.documents.some(d => d.name.endsWith('/parents/missing')));
  assert.equal(new Set(requests.map(r => r.params.readTime)).size, 1);
  assert(requests.filter(r => r.method === 'GET').every(r => r.params.showMissing === true));
});
test('snapshot aborts on incomplete pages, request bounds or wrong resource paths', async () => {
  await assert.rejects(captureSnapshot(async () => { throw Error('network'); }, 'quadmart-development'));
  await assert.rejects(captureSnapshot(async () => ({ nextPageToken: 'repeat' }), 'quadmart-development'));
  await assert.rejects(captureSnapshot(async () => ({ collectionIds: ['x'] }), 'quadmart-development', { maxRequests: 1 }));
  await assert.rejects(captureSnapshot(async method => method === 'POST' ? { collectionIds: ['x'] } : { documents: [{ name: `${rootName('quadmart-4410f')}/x/y`, createTime: 'now' }] }, 'quadmart-development'));
});
test('private key creation never replaces a key; backup is written and verified with private permissions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quadmart-backup-test-'));
  try {
    const file = path.join(dir, 'key'), key = await backupKey(file, { create: true });
    assert.deepEqual(await backupKey(file, { create: true }), key);
    const saved = await saveBackup(dir, sample(), key);
    assert.deepEqual(unseal(await fs.readFile(path.join(dir, saved.filename), 'utf8'), key), sample());
    assert.equal((await fs.stat(path.join(dir, saved.filename))).mode & 0o077, 0);
    await fs.chmod(file, 0o644); await assert.rejects(backupKey(file));
    await fs.chmod(dir, 0o755); await assert.rejects(privateDirectory(dir));
  } finally { await fs.rm(dir, { recursive: true }); }
});
test('retention only removes old files matching the backup naming convention', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quadmart-retention-test-'));
  try {
    const key = randomBytes(32);
    for (let i = 0; i < 3; i++) await saveBackup(dir, sample(), key);
    await fs.writeFile(path.join(dir, 'unrelated.qmb'), 'keep');
    assert.equal(await pruneBackups(dir, 2), 1); assert.equal(await fs.readFile(path.join(dir, 'unrelated.qmb'), 'utf8'), 'keep');
  } finally { await fs.rm(dir, { recursive: true }); }
});
test('restore rejects cloud, normal emulator and nonempty targets before any write', async () => {
  let calls = 0; const request = async () => { calls++; return { collectionIds: ['existing'] }; };
  for (const endpoint of ['https://firestore.googleapis.com', 'http://127.0.0.1:8080']) await assert.rejects(restoreSnapshot(sample(), { endpoint, projectId: 'demo-quadmart-restore', request }));
  assert.equal(calls, 0);
  await assert.rejects(restoreSnapshot(sample(), { endpoint: 'http://127.0.0.1:8180', projectId: 'demo-quadmart-restore', request })); assert.equal(calls, 1);
});
test('REST adapter rejects production endpoints and cloud writes without sending requests', async () => {
  assert.throws(() => firestoreRest({ projectId: 'quadmart-4410f' }));
  assert.throws(() => firestoreRest({ projectId: 'quadmart-development', endpoint: 'https://untrusted.example' }));
  const client = firestoreRest({ projectId: 'quadmart-development', accessToken: async () => { throw Error('must not authenticate'); } });
  await assert.rejects(client('POST', `${root}:commit`, {}));
  await assert.rejects(client('GET', rootName('quadmart-4410f'), {}));
});
