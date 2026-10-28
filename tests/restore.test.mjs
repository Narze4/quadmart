import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreSnapshot, rootName, digest, seal, unseal } from '../lib/operations/backup.mjs';
import { firestoreRest } from '../lib/operations/rest.mjs';
import { randomBytes } from 'node:crypto';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180') throw Error('Isolated restore emulator required');
test('restore an encrypted snapshot into an empty isolated database and verify every field', async () => {
  const from = rootName('quadmart-development'), target = rootName('demo-quadmart-restore');
  const fields = {
    text: { stringValue: 'Synthetic recovery fixture' }, integer: { integerValue: '9007199254740993' },
    timestamp: { timestampValue: '2026-10-28T01:02:03.123456Z' }, ref: { referenceValue: `${from}/profiles/student` },
    point: { geoPointValue: { latitude: 33.79, longitude: -84.32 } }, bytes: { bytesValue: 'AQID' },
    list: { arrayValue: { values: [{ booleanValue: true }, { nullValue: null }] } },
    map: { mapValue: { fields: { amount: { doubleValue: 1.5 } } } }
  };
  const documents = [{ name: `${from}/profiles/student`, fields }, { name: `${from}/missing/parent/messages/child`, fields: { text: { stringValue: 'Retain nested record' } } }].sort((a,b) => a.name.localeCompare(b.name));
  const snapshot = { version: 1, kind: 'firestore-documents', projectId: 'quadmart-development', documentCount: documents.length, checksum: digest(documents), documents };
  const key = randomBytes(32), decrypted = unseal(seal(snapshot, key), key);
  const request = firestoreRest({ projectId: 'demo-quadmart-restore', endpoint: 'http://127.0.0.1:8180' });
  const result = await restoreSnapshot(decrypted, { endpoint: 'http://127.0.0.1:8180', projectId: 'demo-quadmart-restore', request });
  assert.equal(result.restored, 2); assert.equal(result.verified, true);
  assert.equal((await request('GET', `${target}/profiles/student`)).fields.ref.referenceValue, `${target}/profiles/student`);
  await assert.rejects(restoreSnapshot(decrypted, { endpoint: 'http://127.0.0.1:8180', projectId: 'demo-quadmart-restore', request }));
  // Empty target enforcement covers nested-only documents, too.
  assert((await request('POST', `${target}:listCollectionIds`, {})).collectionIds.includes('missing'));
});
