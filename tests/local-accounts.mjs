import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Local emulators required');
const apps = [];
try {
  const ids=[];
  for (const name of ['seller','buyer']) {
    const app=initializeApp({apiKey:'demo-key',projectId:'demo-quadmart'},name);apps.push(app);
    const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
    const email=`${name}@emory.edu`,password='Local-test-only-123!';
    const {user}=await createUserWithEmailAndPassword(auth,email,password);
    ids.push(user.uid);assert.equal(user.emailVerified,false);
    await assert.rejects(getDoc(doc(db,'listings/example')),err=>err.code==='permission-denied');
    await signOut(auth);await signInWithEmailAndPassword(auth,email,password);
    assert.equal(auth.currentUser.uid,user.uid);
    console.log(`${name}: account creation, login, and unverified database denial passed`);
  }
  assert.notEqual(ids[0],ids[1]);
  console.log('Two distinct local Auth accounts verified. Full marketplace flows still require backend integration.');
} finally {await Promise.all(apps.map(deleteApp));}
