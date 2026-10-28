import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateRecovery } from './recovery-schema.mjs';

const FORMAT = 'quadmart-firestore-aes256gcm-v1';
const MAX_BYTES = 64 * 1024 * 1024;
export const sourceProjects = ['demo-quadmart', 'quadmart-development'];
export const rootName = project => `projects/${project}/databases/(default)/documents`;
const check = (ok, message) => { if (!ok) throw new Error(message); };
export function assertSource(project) { check(sourceProjects.includes(project), 'Development backup source required'); }
const segment = value => typeof value === 'string' && value.length > 0 && !['.', '..'].includes(value) && !value.includes('/');
function validDocument(name, root) {
  if (typeof name !== 'string' || !name.startsWith(`${root}/`)) return false;
  const parts = name.slice(root.length + 1).split('/');
  return parts.length % 2 === 0 && parts.every(segment);
}
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

// Both collection discovery and document pages use the SAME readTime. Missing
// parent documents are traversed so orphaned subcollections are not omitted.
export async function captureSnapshot(request, projectId, { now = Date.now(), maxDocuments = 10000, maxRequests = 20000, configuration = {} } = {}) {
  assertSource(projectId);
  const root = rootName(projectId), readTime = new Date(now - 5000).toISOString();
  const documents = [], parents = [root], visited = new Set();
  let requests = 0, bytes = 0;
  const call = async (...args) => {
    check(++requests <= maxRequests && Date.now() - now < 30 * 60 * 1000, 'Snapshot safety bound exceeded');
    return request(...args);
  };
  while (parents.length) {
    const parent = parents.pop();
    check(!visited.has(parent), 'Repeated snapshot parent'); visited.add(parent);
    let collectionsToken;
    do {
      const page = await call('POST', `${parent}:listCollectionIds`, { pageSize: 100, readTime, ...(collectionsToken ? { pageToken: collectionsToken } : {}) });
      for (const collection of page.collectionIds ?? []) {
        check(segment(collection), 'Invalid collection identifier');
        let documentToken;
        do {
          const rows = await call('GET', `${parent}/${collection}`, { pageSize: 100, showMissing: true, readTime, ...(documentToken ? { pageToken: documentToken } : {}) });
          for (const doc of rows.documents ?? []) {
            check(validDocument(doc.name, root) && doc.name.slice(0, doc.name.lastIndexOf('/')) === `${parent}/${collection}`, 'Unexpected snapshot path');
            parents.push(doc.name);
            if (doc.createTime || doc.updateTime) {
              const record = { name: doc.name, fields: doc.fields ?? {} };
              bytes += Buffer.byteLength(JSON.stringify(record));
              check(documents.length < maxDocuments && bytes <= MAX_BYTES, 'Snapshot size bound exceeded');
              documents.push(record);
            }
          }
          check(!rows.nextPageToken || rows.nextPageToken !== documentToken, 'Repeated document page');
          documentToken = rows.nextPageToken;
        } while (documentToken);
      }
      check(!page.nextPageToken || page.nextPageToken !== collectionsToken, 'Repeated collection page');
      collectionsToken = page.nextPageToken;
    } while (collectionsToken);
  }
  documents.sort((a, b) => a.name.localeCompare(b.name));
  return { version: 1, kind: 'firestore-documents', projectId, readTime, capturedAt: new Date().toISOString(), documentCount: documents.length, checksum: digest(documents), documents, configuration, excludes: ['Firebase Auth accounts/passwords', 'Cloudinary image bytes', 'IAM and platform configuration'] };
}
export function validateSnapshot(snapshot) {
  assertSource(snapshot?.projectId);
  check([1, 2].includes(snapshot.version) && snapshot.kind === 'firestore-documents' && Array.isArray(snapshot.documents), 'Invalid backup format');
  check(snapshot.documentCount === snapshot.documents.length && snapshot.documentCount <= 10000, 'Invalid backup count');
  const names = new Set();
  for (const doc of snapshot.documents) {
    check(validDocument(doc.name, rootName(snapshot.projectId)) && doc.fields && typeof doc.fields === 'object' && !Array.isArray(doc.fields) && !names.has(doc.name), 'Invalid backup document');
    names.add(doc.name);
  }
  check(snapshot.checksum === digest(snapshot.documents), 'Backup checksum mismatch');
  if (snapshot.version === 2) { validateRecovery(snapshot.recovery, snapshot.projectId); check(snapshot.recoveryChecksum === digest(snapshot.recovery), 'Recovery checksum mismatch'); }
  return snapshot;
}
export function seal(snapshot, key) {
  validateSnapshot(snapshot); check(Buffer.isBuffer(key) && key.length === 32, 'Invalid backup key');
  const raw = Buffer.from(JSON.stringify(snapshot)); check(raw.length <= MAX_BYTES, 'Backup too large');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(FORMAT));
  const ciphertext = Buffer.concat([cipher.update(raw), cipher.final()]);
  return JSON.stringify({ format: FORMAT, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}
export function unseal(text, key) {
  check(Buffer.byteLength(text) <= MAX_BYTES * 1.4 && Buffer.isBuffer(key) && key.length === 32, 'Invalid encrypted backup');
  const data = JSON.parse(text); check(data.format === FORMAT, 'Unknown encrypted format');
  const iv = Buffer.from(data.iv, 'base64'), tag = Buffer.from(data.tag, 'base64');
  check(iv.length === 12 && tag.length === 16, 'Invalid authentication envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(FORMAT)); decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(data.ciphertext, 'base64')), decipher.final()]);
  return validateSnapshot(JSON.parse(plaintext.toString('utf8')));
}
export async function privateDirectory(directory) {
  check(path.isAbsolute(directory), 'Absolute private directory required');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  check(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, 'Backup directory must be private and not a symlink');
}
export async function backupKey(file, { create = false } = {}) {
  if (create) {
    try { await fs.writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const stat = await fs.lstat(file);
  check(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && stat.size === 32, 'Private 32-byte backup key required');
  return fs.readFile(file);
}
export async function saveBackup(directory, snapshot, key) {
  await privateDirectory(directory);
  const filename = `quadmart-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.qmb`;
  const destination = path.join(directory, filename), temporary = `${destination}.partial`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(seal(snapshot, key)); await handle.sync(); } finally { await handle.close(); }
  const verified = unseal(await fs.readFile(temporary, 'utf8'), key);
  check(verified.checksum === snapshot.checksum, 'Written backup verification failed');
  await fs.rename(temporary, destination);
  return { filename, documentCount: snapshot.documentCount, checksum: snapshot.checksum, readTime: snapshot.readTime, ...(snapshot.version === 2 ? { accountCount: snapshot.recovery.auth.accountCount, photoCount: snapshot.recovery.photoCount, photoBytes: snapshot.recovery.photoBytes, fullRecovery: true } : {}) };
}
export async function pruneBackups(directory, keep = 28) {
  check(Number.isInteger(keep) && keep >= 2, 'Keep at least two backups');
  const names = (await fs.readdir(directory)).filter(n => /^quadmart-[0-9T-]+Z-[a-f0-9-]{36}\.qmb$/.test(n)).sort().reverse();
  for (const name of names.slice(keep)) {
    const file = path.join(directory, name), stat = await fs.lstat(file);
    check(stat.isFile() && !stat.isSymbolicLink(), 'Unexpected backup entry');
    await fs.unlink(file);
  }
  return names.slice(keep).length;
}

function rewrite(value, from, to) {
  if (Array.isArray(value)) return value.map(v => rewrite(v, from, to));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'referenceValue' && typeof v === 'string' && v.startsWith(`${from}/`) ? to + v.slice(from.length) : rewrite(v, from, to)]));
  return value;
}
export async function restoreSnapshot(snapshot, { endpoint, projectId, request }) {
  validateSnapshot(snapshot);
  check(endpoint === 'http://127.0.0.1:8180' && projectId === 'demo-quadmart-restore', 'Restore is restricted to the isolated loopback rehearsal emulator');
  const root = rootName(projectId), from = rootName(snapshot.projectId);
  const existing = await request('POST', `${root}:listCollectionIds`, { pageSize: 1 });
  check(!(existing.collectionIds?.length), 'Restore target must be empty');
  const docs = snapshot.documents.map(doc => ({ name: root + doc.name.slice(from.length), fields: rewrite(doc.fields, from, root) }));
  for (let i = 0; i < docs.length; i += 100) {
    await request('POST', `projects/${projectId}/databases/(default)/documents:commit`, { writes: docs.slice(i, i + 100).map(doc => ({ update: doc, currentDocument: { exists: false } })) });
  }
  // Independently read every restored document; metadata is server-generated.
  const restored = [];
  for (const expected of docs) {
    const actual = await request('GET', expected.name, {});
    restored.push({ name: actual.name, fields: actual.fields ?? {} });
  }
  check(digest(restored) === digest(docs), 'Restored document verification failed');
  return { restored: docs.length, verified: true, target: projectId };
}
