import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { operate } from '../lib/server/market.mjs';
import { LIMITS, limitId, consumeQuota } from '../lib/server/limits.mjs';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Local emulator required');
const app=initializeApp({projectId:'demo-quadmart'},'abuse-tests'),db=getFirestore(app);
const seller={uid:'seller',email:'seller@emory.edu',email_verified:true},buyer={uid:'buyer',email:'buyer@emory.edu',email_verified:true};
const api=(who,action,data={})=>operate(db,who,action,data);
const denied=status=>e=>e.status===status;
const input=(extra={})=>({title:'Test desk',description:'Development only',price:30,category:'Product',condition:'Good',imageIds:[],requestId:crypto.randomUUID(),...extra});
const quota=(who,bucket)=>db.doc(`operationLimits/${limitId(who.uid,bucket)}`);
async function nearLimit(who,bucket,{minuteCount=0,dayCount=0}={}) {
 const now=Date.now();await quota(who,bucket).set({minute:Math.floor(now/60000),day:Math.floor(now/86400000),minuteCount,dayCount});
}
beforeEach(async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents',{method:'DELETE'});
 for(const who of [seller,buyer])await api(who,'profile',{displayName:who.uid});
});
after(async()=>{await db.terminate();await deleteApp(app)});
for(const [name,extra] of [
 ['forged seller',{sellerUid:'buyer'}],['forged email',{sellerEmail:'buyer@emory.edu'}],['forged campus',{campusId:'uga.edu'}],['negative price',{price:-1}],['text price',{price:'30'}],['nonfinite price',{price:NaN}],['price ceiling',{price:100001}],['oversized title',{title:'x'.repeat(121)}],['empty title',{title:'  '}],['oversized description',{description:'x'.repeat(5001)}],['invalid category',{category:'Other'}],['invalid condition',{condition:'Other'}],['client timestamp',{createdAt:0}],['presold status',{status:'sold'}],['arbitrary image URL',{images:['https://untrusted/image']}],['invalid photo ID',{imageIds:['../secret']}],['too many photos',{imageIds:'abcdef'.split('').map(x=>x.repeat(64))}],['duplicate photo',{imageIds:['a'.repeat(64),'a'.repeat(64)]}],
])test(`listing API rejects ${name} without debit or writes`,async()=>{
 await assert.rejects(api(seller,'listingCreate',input(extra)),denied(400));
 assert.equal((await db.collection('listings').get()).size,0);assert.equal((await quota(seller,'listingCreate').get()).exists,false);
});
test('owned photos attach; foreign, wrong-campus, unavailable and mismatched assets fail',async()=>{
 const ids='abcde'.split('').map(x=>x.repeat(64));
 for(const id of ids)await db.doc(`media/${id}`).set({status:'ready',ownerUid:seller.uid,campusId:'emory.edu',url:`/api/photos/${id}`});
 const {id}=await api(seller,'listingCreate',input({imageIds:ids}));
 const l=(await db.doc(`listings/${id}`).get()).data();assert.equal(l.images.length,5);assert.equal(l.sellerUid,seller.uid);assert.equal(l.campusId,'emory.edu');assert.equal(l.version,0);assert.ok(l.createdAt.toMillis()>0);
 for(const patch of [{ownerUid:'buyer'},{campusId:'uga.edu'},{status:'pending'},{status:'failed'},{status:'blocked'},{url:'https://untrusted/image'}]) {
  await db.doc(`media/${ids[0]}`).set({status:'ready',ownerUid:seller.uid,campusId:'emory.edu',url:`/api/photos/${ids[0]}`,...patch});
  await assert.rejects(api(seller,'listingCreate',input({imageIds:[ids[0]]})),denied(400));
 }
 await db.doc(`media/${ids[0]}`).delete();await assert.rejects(api(seller,'listingCreate',input({imageIds:[ids[0]]})),denied(400));
 assert.equal((await quota(seller,'listingCreate').get()).data().dayCount,1);
});
test('concurrent publication retries make one listing and debit once; conflicts cannot overwrite it',async()=>{
 const data=input(),results=await Promise.all([api(seller,'listingCreate',data),api(seller,'listingCreate',data),api(seller,'listingCreate',data)]);
 assert.equal(new Set(results.map(x=>x.id)).size,1);assert.equal((await db.collection('listings').get()).size,1);assert.equal((await quota(seller,'listingCreate').get()).data().dayCount,1);
 await nearLimit(seller,'listingCreate',{dayCount:LIMITS.listingCreate.day});
 assert.equal((await api(seller,'listingCreate',data)).id,results[0].id);
 await assert.rejects(api(seller,'listingCreate',{...data,title:'Different'}),denied(409));
 await db.doc(`listings/${results[0].id}`).delete();await assert.rejects(api(seller,'listingCreate',data),denied(409));
 assert.equal((await db.collection('listings').get()).size,0);
});
test('concurrent new listings cannot exceed shared daily quota; other users are isolated',async()=>{
 await nearLimit(seller,'listingCreate',{dayCount:LIMITS.listingCreate.day-2});
 const results=await Promise.allSettled(Array.from({length:4},()=>api(seller,'listingCreate',input())));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
 assert.equal((await db.collection('listings').get()).size,2);assert.equal((await db.collection('listingRequests').get()).size,2);
 await api(buyer,'listingCreate',input());
});
test('quota minute/day windows, retry times and account isolation use server time',async()=>{
 const start=Date.UTC(2026,9,28,12,0,10);
 for(let i=0;i<LIMITS.listingCreate.minute;i++)await consumeQuota(db,'window-user','listingCreate',start);
 await assert.rejects(consumeQuota(db,'window-user','listingCreate',start),e=>e.status===429&&e.retryAfterSeconds===50);
 await consumeQuota(db,'window-user','listingCreate',start+60000);
 await consumeQuota(db,'different-user','listingCreate',start);
 const ref=db.doc(`operationLimits/${limitId('window-user','listingCreate')}`);
 await ref.set({minute:Math.floor(start/60000),minuteCount:0,day:Math.floor(start/86400000),dayCount:LIMITS.listingCreate.day});
 await assert.rejects(consumeQuota(db,'window-user','listingCreate',start),e=>e.status===429&&e.retryAfterSeconds===43190);
 await consumeQuota(db,'window-user','listingCreate',start+86400000);
 assert.equal((await ref.get()).data().dayCount,1);
});
test('reservation retries succeed; stale tabs, altered retries, foreign actors and sold listings fail',async()=>{
 const {id}=await api(seller,'listingCreate',input());
 const change={listingId:id,status:'reserved',expectedVersion:0,requestId:'reserve'};
 const results=await Promise.all([api(seller,'listingState',change),api(seller,'listingState',change)]);assert.equal(results[0].version,1);assert.equal(results[1].version,1);
 assert.equal((await quota(seller,'listingState').get()).data().dayCount,1);
 await assert.rejects(api(seller,'listingState',{...change,status:'active'}),denied(409));
 await assert.rejects(api(buyer,'listingState',{...change,expectedVersion:1}),denied(403));
 await api(seller,'listingState',{...change,status:'active',expectedVersion:1,requestId:'unreserve'});
 await assert.rejects(api(seller,'listingState',change),denied(409));
 await nearLimit(seller,'listingState',{dayCount:LIMITS.listingState.day});
 await assert.rejects(api(seller,'listingState',{...change,expectedVersion:2,requestId:'again'}),denied(429));
 assert.equal((await db.doc(`listings/${id}`).get()).data().status,'active');
 await api(seller,'sale',{listingId:id,buyerUid:null});await assert.rejects(api(seller,'listingState',{...change,expectedVersion:2}),denied(409));
});
test('message quota commits atomically with message, preview and notification; retries do not debit',async()=>{
 const {id}=await api(seller,'listingCreate',input()),c=await api(buyer,'conversation',{listingId:id});
 await nearLimit(buyer,'message',{dayCount:LIMITS.message.day-2});
 const results=await Promise.allSettled(Array.from({length:4},(_,i)=>api(buyer,'message',{conversationId:c.id,text:`Message ${i}`,requestId:`m${i}`})));
 const success=results.flatMap((r,i)=>r.status==='fulfilled'?[i]:[]);assert.equal(success.length,2);assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
 assert.equal((await db.collection(`conversations/${c.id}/messages`).get()).size,2);assert.equal((await db.collection('notifications').get()).size,2);
 const preview=(await db.doc(`conversations/${c.id}`).get()).data().lastMessage;assert(success.some(i=>`Message ${i}`===preview));
 await api(buyer,'message',{conversationId:c.id,text:`Message ${success[0]}`,requestId:`m${success[0]}`});
 assert.equal((await quota(buyer,'message').get()).data().dayCount,LIMITS.message.day);
 await assert.rejects(api(buyer,'message',{conversationId:c.id,text:'Altered',requestId:`m${success[0]}`}),denied(409));
});
test('new conversation quota cannot be bypassed; existing threads remain accessible',async()=>{
 const a=await api(seller,'listingCreate',input()),b=await api(seller,'listingCreate',input());
 await nearLimit(buyer,'conversation',{dayCount:LIMITS.conversation.day-1});
 const c=await api(buyer,'conversation',{listingId:a.id});
 await assert.rejects(api(buyer,'conversation',{listingId:b.id}),denied(429));
 assert.equal((await api(buyer,'conversation',{listingId:a.id})).id,c.id);assert.equal((await db.collection('conversations').get()).size,1);
});
test('unchanged profiles do not write or debit; actual name changes are limited',async()=>{
 const ref=db.doc('publicProfiles/seller'),before=await ref.get();
 await nearLimit(seller,'profile',{dayCount:LIMITS.profile.day});
 await api(seller,'profile');assert.equal((await ref.get()).updateTime.toMillis(),before.updateTime.toMillis());
 await assert.rejects(api(seller,'profile',{displayName:'Changed'}),denied(429));assert.equal((await ref.get()).data().displayName,'seller');
});
test('suspended and unverified users cannot publish or consume business quotas',async()=>{
 await assert.rejects(api({...seller,email_verified:false},'listingCreate',input()),denied(403));
 await db.doc('moderationAccounts/seller').set({suspended:true});await assert.rejects(api(seller,'listingCreate',input()),denied(403));
 assert.equal((await quota(seller,'listingCreate').get()).exists,false);
});
