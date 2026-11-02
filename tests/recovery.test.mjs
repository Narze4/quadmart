import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fixture, account, hashConfig } from './recovery-fixture.mjs';
import { addRecovery, captureAccounts, restorePhotosLocally, restoreAccountsLocally } from '../lib/operations/recovery.mjs';
import { seal, unseal, saveBackup } from '../lib/operations/backup.mjs';
import { validateHashConfig } from '../lib/operations/recovery-schema.mjs';
import { registerOffsite, preparedBackup } from '../lib/operations/offsite.mjs';
test('complete recovery encrypts account hashes, hash parameters and actual JPEG bytes',async()=>{
 const {snapshot,services}=await fixture(), full=await addRecovery(snapshot,services),key=randomBytes(32),encrypted=seal(full,key);
 assert.equal(full.recovery.auth.accountCount,1);assert.equal(full.recovery.photoCount,1);
 for(const secret of [account().email,account().passwordHash,hashConfig().signerKey,full.recovery.photos[0].bytes])assert(!encrypted.includes(secret));
 assert.deepEqual(unseal(encrypted,key),full);
 const damaged=structuredClone(full);damaged.recovery.photos[0].bytes='YmFk';assert.throws(()=>seal(damaged,key));
});
test('account export refuses missing hashes, unsupported providers, MFA and duplicate pages',async()=>{
 for(const alter of [u=>delete u.passwordHash,u=>u.providerData.push({providerId:'google.com'}),u=>u.multiFactor={enrolledFactors:[{}]},u=>u.tenantId='tenant']){
  const u=account();alter(u);await assert.rejects(captureAccounts({listUsers:async()=>({users:[u]})}));
 }
 await assert.rejects(captureAccounts({listUsers:async()=>({users:[],pageToken:'repeat'})}));
 assert.throws(()=>validateHashConfig({...hashConfig(),algorithm:'STANDARD_SCRYPT'}));
});
test('account pagination retains users and detects changed credentials during capture',async()=>{
 let calls=0;const result=await captureAccounts({listUsers:async(_n,token)=>token?{users:[{...account(),uid:'two'}]}:{users:[account()],pageToken:'two'}});assert.equal(result.length,2);
 const {snapshot,services}=await fixture();services.auth.listUsers=async()=>({users:[{...account(),disabled:calls++>0}]});
 await assert.rejects(addRecovery(snapshot,services),/Accounts changed/);
});
test('required photos cannot disappear or escape scope; unfinished missing uploads are recorded',async()=>{
 const {snapshot,services}=await fixture();services.downloadPhoto=async()=>({missing:true});
 await assert.rejects(addRecovery(snapshot,services),/Required photo/);
 snapshot.documents[0].fields.status.stringValue='failed';const full=await addRecovery(snapshot,services);assert.equal(full.recovery.photoCount,0);assert.equal(full.recovery.skipped.length,1);
 snapshot.documents[0].fields.publicId.stringValue='other/project/photo';await assert.rejects(addRecovery(snapshot,services),/namespace/);
});
test('invalid and oversized stored photo bytes stop capture',async()=>{
 const {snapshot,services}=await fixture();
 for(const bytes of [Buffer.from('not-an-image'),Buffer.alloc(4*1024*1024+1)])await assert.rejects(addRecovery(snapshot,{...services,downloadPhoto:async()=>({bytes})}));
});
test('photo restore checks bytes and refuses overwrites; Auth restore refuses cloud targets',async()=>{
 const {snapshot,services}=await fixture(),full=await addRecovery(snapshot,services),dir=await fs.mkdtemp(path.join(os.tmpdir(),'qm-photo-restore-'));
 try{assert.equal((await restorePhotosLocally(full.recovery,dir)).restoredPhotos,1);await assert.rejects(restorePhotosLocally(full.recovery,dir));await assert.rejects(restoreAccountsLocally(full.recovery));}finally{await fs.rm(dir,{recursive:true});}
});
test('offsite receipts require matching downloaded bytes and owner-only destination metadata',async()=>{
 const {snapshot,services}=await fixture(),full=await addRecovery(snapshot,services),key=randomBytes(32),dir=await fs.mkdtemp(path.join(os.tmpdir(),'qm-offsite-'));
 try{
 const saved=await saveBackup(dir,full,key),filename=saved.filename,file=path.join(dir,filename),downloadedFile=path.join(dir,'download');await fs.copyFile(file,downloadedFile);
 const metadata={id:'drive-id',title:filename,size:(await fs.stat(file)).size,mime_type:'application/octet-stream',parent_ids:['folder'],shared:false,permissions:[{type:'user',role:'owner',emailAddress:'owner@example.com'}]};
 const args={directory:dir,filename,downloadedFile,metadata,folderId:'folder',ownerEmail:'owner@example.com',key};
 await assert.rejects(preparedBackup(args));
 for(const change of [{shared:true},{parent_ids:['other']},{size:1},{permissions:[...metadata.permissions,{type:'anyone',role:'reader'}]}])await assert.rejects(registerOffsite({...args,metadata:{...metadata,...change}}));
 await fs.appendFile(downloadedFile,'bad');await assert.rejects(registerOffsite(args));await fs.copyFile(file,downloadedFile);
 await registerOffsite(args);assert.equal((await preparedBackup(args)).offsiteVerified,true);
 await assert.rejects(preparedBackup({...args,now:Date.now()+31*60000}));await assert.rejects(preparedBackup({...args,folderId:'wrong'}));await assert.rejects(preparedBackup({...args,key:randomBytes(32)}));
 await fs.appendFile(file,'tampered');await assert.rejects(preparedBackup(args));
 }finally{await fs.rm(dir,{recursive:true});}
});

test('recovery-key import reads a private note and never overwrites or echoes key material',async()=>{
 const {spawnSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'qm-key-recovery-'));
 try{const key=randomBytes(32),note=path.join(dir,'note'),target=path.join(dir,'key');await fs.writeFile(note,`QUADMART-RECOVERY-KEY-v1:${key.toString('base64')}`,{mode:0o600});
 const args=[fileURLToPath(new URL('../scripts/recover-backup-key.mjs',import.meta.url)),note,target];
 const first=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(first.status,0);assert(!first.stdout.includes(key.toString('base64')));assert.deepEqual(await fs.readFile(target),key);
 assert.equal(spawnSync(process.execPath,args).status,1);
 await fs.chmod(note,0o644);assert.equal(spawnSync(process.execPath,[args[0],note,path.join(dir,'other')]).status,1);
 }finally{await fs.rm(dir,{recursive:true});}
});
