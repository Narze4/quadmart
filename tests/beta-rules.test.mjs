import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, limit } from 'firebase/firestore';
import { betaRules } from '../scripts/beta-rules.mjs';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Isolated Firestore emulator required');
let env;
const policy = { mode: 'invite-only', campusId: 'emory.edu' }, membership = { active: true, campusId: 'emory.edu' };
const seed = (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));
const actor = (email = 'beta@emory.edu', verified = true) => env.authenticatedContext('beta', { email, email_verified: verified }).firestore();
before(async () => {
  const source = await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  const generated = await fs.readFile(new URL('../firestore.beta.rules', import.meta.url), 'utf8');
  assert.equal(generated, betaRules(source));
  env = await initializeTestEnvironment({ projectId: 'demo-quadmart', firestore: { rules: generated } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed('listings/fixture', { campusId: 'emory.edu', sellerUid: 'beta', status: 'active' });
  await seed('betaAccess/beta', membership);
});
after(async () => { await env?.cleanup(); });
test('beta rules deny reads, queries and deletes when policy is absent despite active membership', async () => {
  const db = actor();
  await assertFails(getDoc(doc(db, 'listings/fixture')));
  await assertFails(getDocs(query(collection(db, 'listings'), where('campusId', '==', 'emory.edu'), limit(25))));
  await assertFails(deleteDoc(doc(db, 'listings/fixture')));
});
test('approved beta access closes immediately when the policy is removed or malformed', async () => {
  const db = actor();
  await seed('betaSettings/access', policy);
  await assertSucceeds(getDoc(doc(db, 'listings/fixture')));
  await env.withSecurityRulesDisabled(c => deleteDoc(doc(c.firestore(), 'betaSettings/access')));
  await assertFails(getDoc(doc(db, 'listings/fixture')));
  for (const invalid of [{}, { mode: 'open', campusId: 'emory.edu' }, { mode: 'invite-only', campusId: 'uga.edu' }]) {
    await seed('betaSettings/access', invalid);
    await assertFails(getDoc(doc(db, 'listings/fixture')));
  }
});
test('beta generated rules preserve verification, campus and server-only approval checks', async () => {
  await seed('betaSettings/access', policy);
  await assertFails(getDoc(doc(actor('beta@emory.edu', false), 'listings/fixture')));
  await assertFails(getDoc(doc(actor('beta@uga.edu'), 'listings/fixture')));
  const db = actor();
  await assertSucceeds(getDoc(doc(db, 'betaAccess/beta')));
  await assertFails(setDoc(doc(db, 'betaAccess/beta'), membership));
  await assertFails(setDoc(doc(db, 'betaSettings/access'), policy));
  await seed('betaAccess/beta', { ...membership, active: false });
  await assertFails(getDoc(doc(db, 'listings/fixture')));
});
test('rules generator rejects an unrecognized source rather than generating permissive rules', () => {
  assert.throws(() => betaRules('rules_version = "2";'));
  assert.throws(() => betaRules('function betaPolicyRequired() { return false; }'.repeat(2)));
});
test('beta deploy preflight refuses missing, development and production targets', () => {
  const command = fileURLToPath(new URL('../scripts/beta-rules.mjs', import.meta.url));
  for (const projectId of ['', 'quadmart-development', 'quadmart-4410f', 'quadmart-beta']) {
    const run = spawnSync(process.execPath, [command, '--check', '--deployment'], {
      env: { ...process.env, GCLOUD_PROJECT: projectId }, timeout: 10000, encoding: 'utf8',
    });
    assert.equal(run.error, undefined);
    if (projectId === 'quadmart-beta') assert.equal(run.status, 0);
    else { assert.notEqual(run.status, 0); assert.match(run.stderr, /only be deployed to quadmart-beta/); }
  }
});
