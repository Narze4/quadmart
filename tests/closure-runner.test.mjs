import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClosureRunner } from '../lib/closure-runner.mjs';
test('parallel screen mounts share one deletion flow and Auth removal waits for database cleanup',async()=>{
 const events=[],user={uid:'owner'};let step=0;
 const run=createClosureRunner({currentUser:()=>user,callApi:async action=>{assert.equal(action,'accountCloseStep');events.push('batch');return{readyForAuthDeletion:++step===3}},deleteLogin:async u=>{assert.equal(u,user);events.push('delete')}});
 await Promise.all([run(),run()]);assert.deepEqual(events,['batch','batch','batch','delete']);
});
test('network/limit failure leaves Auth intact and a subsequent attempt resumes',async()=>{
 let calls=0,deletes=0;
 const run=createClosureRunner({currentUser:()=>({uid:'owner'}),callApi:async()=>{if(++calls===1)throw Error('limit');return{readyForAuthDeletion:true}},deleteLogin:async()=>{deletes++}});
 await assert.rejects(run());assert.equal(deletes,0);await run();assert.equal(deletes,1);
});
test('a large history stops at a bounded number of batches without removing the login',async()=>{
 let calls=0,deletes=0;
 const run=createClosureRunner({currentUser:()=>({uid:'owner'}),callApi:async()=>{calls++;return{readyForAuthDeletion:false}},deleteLogin:async()=>{deletes++}});
 await assert.rejects(run(),/More cleanup remains/);assert.equal(calls,20);assert.equal(deletes,0);
});
test('changing accounts mid-flight cannot delete a login or continue under the other identity',async()=>{
 for(const readyForAuthDeletion of [true,false]) {
  let user={uid:'owner'},calls=0,deletes=0;
  const run=createClosureRunner({currentUser:()=>user,callApi:async()=>{calls++;user={uid:'other'};return{readyForAuthDeletion}},deleteLogin:async()=>{deletes++}});
  await assert.rejects(run(),/account changed/);assert.equal(calls,1);assert.equal(deletes,0);
 }
});
test('Auth failure can retry the already-clean database; signed-out users cannot start',async()=>{
 let attempts=0;
 const run=createClosureRunner({currentUser:()=>({uid:'owner'}),callApi:async()=>({readyForAuthDeletion:true}),deleteLogin:async()=>{if(++attempts===1)throw Error('reauth required')}});
 await assert.rejects(run());await run();assert.equal(attempts,2);
 await assert.rejects(createClosureRunner({currentUser:()=>null,callApi:()=>{throw Error('must not call')},deleteLogin:()=>{throw Error('must not call')}})(),/Sign in again/);
});
