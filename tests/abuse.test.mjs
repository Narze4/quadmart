import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { operate } from '../lib/server/market.mjs';
import { LIMITS, GLOBAL_LIMITS, limitId, consumeQuota } from '../lib/server/limits.mjs';
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

for(const bucket of ['api','uploadAttempt','photo'])test(`${bucket} shared budget is atomic across accounts and resumes next day`,async()=>{
 const now=Date.UTC(2026,9,29,12,0,10),ref=db.doc(`operationLimits/global-${bucket}`);
 await ref.set({minute:Math.floor(now/60000),day:Math.floor(now/86400000),minuteCount:0,dayCount:GLOBAL_LIMITS[bucket].day-2});
 const ids=['one','two','three','four'];
 const results=await Promise.allSettled(ids.map(uid=>consumeQuota(db,uid,bucket,now)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
 assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429&&r.reason.retryAfterSeconds===43190));
 assert.equal((await ref.get()).data().dayCount,GLOBAL_LIMITS[bucket].day);
 for(let i=0;i<ids.length;i++)assert.equal((await db.doc(`operationLimits/${limitId(ids[i],bucket)}`).get()).exists,results[i].status==='fulfilled');
 await consumeQuota(db,'new-account',bucket,now+86400000);
 assert.equal((await ref.get()).data().dayCount,1);
});
test('account attempt rejection does not consume the shared budget',async()=>{
 const now=Date.UTC(2026,9,29,12,0,10);
 await db.doc(`operationLimits/${limitId('blocked','photo')}`).set({minute:Math.floor(now/60000),minuteCount:LIMITS.photo.minute,day:Math.floor(now/86400000),dayCount:LIMITS.photo.minute});
 await assert.rejects(consumeQuota(db,'blocked','photo',now),e=>e.status===429&&e.retryAfterSeconds===50);
 assert.equal((await db.doc('operationLimits/global-photo').get()).exists,false);
});

async function savedFixtures() {
  for (const id of ['first', 'second', 'third']) await db.doc(`listings/${id}`).set({ campusId: 'emory.edu', status: 'active', sellerUid: seller.uid });
}
test('saved changes are atomic, preserve private profile fields and isolate accounts', async () => {
  await savedFixtures();
  await Promise.all(['first', 'second'].map(listingId => api(buyer, 'savedSet', { listingId, saved: true })));
  const profile = (await db.doc('users/buyer').get()).data();
  assert.deepEqual([...profile.savedListings].sort(), ['first', 'second']); assert.equal(profile.email, buyer.email); assert.equal(profile.transactions, 0);
  assert.equal((await db.doc('users/seller').get()).data().savedListings, undefined);
  await api(buyer, 'savedSet', { listingId: 'first', saved: false });
  assert.deepEqual((await db.doc('users/buyer').get()).data().savedListings, ['second']);
});
test('duplicate saved requests write and debit once; unchanged retries succeed at the operation limit', async () => {
  await savedFixtures(); const data = { listingId: 'first', saved: true };
  await Promise.all([api(buyer, 'savedSet', data), api(buyer, 'savedSet', data)]);
  assert.equal((await quota(buyer, 'savedSet').get()).data().dayCount, 1);
  const ref = db.doc('users/buyer'), before = await ref.get();
  await nearLimit(buyer, 'savedSet', { dayCount: LIMITS.savedSet.day });
  await api(buyer, 'savedSet', data);
  assert.equal((await ref.get()).updateTime.toMillis(), before.updateTime.toMillis());
  await assert.rejects(api(buyer, 'savedSet', { ...data, saved: false }), denied(429));
});
test('saved items enforce the 200-item cap under concurrent requests and allow removal at capacity', async () => {
  await savedFixtures(); await db.doc('users/buyer').update({ savedListings: Array.from({ length: 199 }, (_, i) => `old-${i}`) });
  const result = await Promise.allSettled(['first', 'second'].map(listingId => api(buyer, 'savedSet', { listingId, saved: true })));
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(result.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal((await db.doc('users/buyer').get()).data().savedListings.length, 200);
  await api(buyer, 'savedSet', { listingId: 'old-0', saved: false });
  assert.equal((await db.doc('users/buyer').get()).data().savedListings.length, 199);
});
test('saving rejects inaccessible listings but removing missing or foreign legacy entries succeeds', async () => {
  await db.doc('listings/foreign').set({ campusId: 'uga.edu', status: 'active' });
  await db.doc('listings/removed').set({ campusId: 'emory.edu', status: 'removed' });
  for (const listingId of ['missing', 'foreign', 'removed']) await assert.rejects(api(buyer, 'savedSet', { listingId, saved: true }), denied(404));
  assert.equal((await quota(buyer, 'savedSet').get()).exists, false);
  await db.doc('users/buyer').update({ savedListings: ['missing', 'foreign'] });
  for (const listingId of ['missing', 'foreign']) await api(buyer, 'savedSet', { listingId, saved: false });
  assert.deepEqual((await db.doc('users/buyer').get()).data().savedListings, []);
});
test('saved API rejects path injection, non-booleans and forged recipients or fields', async () => {
  for (const data of [{ listingId: '../first', saved: true }, { listingId: 'first', saved: 'true' }, { listingId: 'first', saved: true, uid: seller.uid }, { savedListings: ['first'] }]) await assert.rejects(api(buyer, 'savedSet', data), denied(400));
  assert.equal((await quota(buyer, 'savedSet').get()).exists, false);
});
test('concurrent saved changes cannot exceed quota and rejected changes leave data unchanged', async () => {
  await savedFixtures(); await nearLimit(buyer, 'savedSet', { dayCount: LIMITS.savedSet.day - 1 });
  const results = await Promise.allSettled(['first', 'second'].map(listingId => api(buyer, 'savedSet', { listingId, saved: true })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 429);
  assert.equal((await db.doc('users/buyer').get()).data().savedListings.length, 1);
  await api(seller, 'savedSet', { listingId: 'third', saved: true });
});
async function notificationFixtures() {
  const batch = db.batch();
  for (let i = 0; i < 31; i++) batch.set(db.doc(`notifications/notice-${i}`), { userId: buyer.uid, read: false, title: `Notice ${i}`, description: 'Preserve this', linkTo: '/saved' });
  batch.set(db.doc('notifications/foreign'), { userId: seller.uid, read: false, title: 'Private' });
  await batch.commit();
}
test('notification API changes exactly 30 selected owned flags and preserves content', async () => {
  await notificationFixtures(); const ids = Array.from({ length: 30 }, (_, i) => `notice-${i}`);
  assert.deepEqual((await api(buyer, 'notificationsRead', { ids })).ids, ids);
  for (const id of ids) assert.deepEqual((await db.doc(`notifications/${id}`).get()).data(), { userId: buyer.uid, read: true, title: `Notice ${id.split('-')[1]}`, description: 'Preserve this', linkTo: '/saved' });
  assert.equal((await db.doc('notifications/notice-30').get()).data().read, false);
  assert.equal((await quota(buyer, 'notificationsRead').get()).data().dayCount, 1);
});
test('mixed-recipient or missing notification batches fail atomically without quota or partial reads', async () => {
  await notificationFixtures();
  for (const id of ['foreign', 'missing']) await assert.rejects(api(buyer, 'notificationsRead', { ids: ['notice-0', id] }), denied(403));
  assert.equal((await db.doc('notifications/notice-0').get()).data().read, false);
  assert.equal((await quota(buyer, 'notificationsRead').get()).exists, false);
});
test('duplicate and concurrent notification retries debit once and do not rewrite acknowledged records', async () => {
  await notificationFixtures(); const data = { ids: ['notice-0', 'notice-0'] };
  await Promise.all([api(buyer, 'notificationsRead', data), api(buyer, 'notificationsRead', data)]);
  assert.equal((await quota(buyer, 'notificationsRead').get()).data().dayCount, 1);
  const ref = db.doc('notifications/notice-0'), before = await ref.get();
  await nearLimit(buyer, 'notificationsRead', { dayCount: LIMITS.notificationsRead.day });
  assert.deepEqual((await api(buyer, 'notificationsRead', data)).ids, ['notice-0']);
  assert.equal((await ref.get()).updateTime.toMillis(), before.updateTime.toMillis());
  await assert.rejects(api(buyer, 'notificationsRead', { ids: ['notice-0', 'notice-1'] }), denied(429));
  assert.equal((await db.doc('notifications/notice-1').get()).data().read, false);
});
test('notification API rejects oversized or malformed requests and forged ownership/read values', async () => {
  await notificationFixtures();
  for (const data of [{ ids: Array.from({ length: 31 }, (_, i) => `notice-${i}`) }, { ids: [] }, { ids: ['../notice'] }, { ids: 'notice-0' }, { ids: ['notice-0'], userId: seller.uid }, { ids: ['notice-0'], read: false }]) await assert.rejects(api(buyer, 'notificationsRead', data), denied(400));
  assert.equal((await quota(buyer, 'notificationsRead').get()).exists, false);
});
test('notification quota is atomic across concurrent batches and separate across accounts', async () => {
  await notificationFixtures(); await nearLimit(buyer, 'notificationsRead', { dayCount: LIMITS.notificationsRead.day - 1 });
  const results = await Promise.allSettled(['notice-0', 'notice-1'].map(id => api(buyer, 'notificationsRead', { ids: [id] })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 429);
  assert.equal((await db.collection('notifications').where('userId', '==', buyer.uid).where('read', '==', true).get()).size, 1);
  await api(seller, 'notificationsRead', { ids: ['foreign'] });
});
test('closed, suspended, unverified and wrong-campus accounts cannot change saves or acknowledgements', async () => {
  await savedFixtures(); await notificationFixtures();
  for (const [action, data] of [['savedSet', { listingId: 'first', saved: true }], ['notificationsRead', { ids: ['notice-0'] }]]) {
    await assert.rejects(api({ ...buyer, email_verified: false }, action, data), denied(403));
    await assert.rejects(api({ ...buyer, email: 'buyer@uga.edu' }, action, data), denied(403));
    for (const [collection, field] of [['accountLifecycle', 'closed'], ['moderationAccounts', 'suspended']]) {
      const ref = db.doc(`${collection}/${buyer.uid}`); await ref.set({ [field]: true }); await assert.rejects(api(buyer, action, data), denied(403)); await ref.delete();
    }
  }
  assert.equal((await db.doc('notifications/notice-0').get()).data().read, false);
  assert.equal((await quota(buyer, 'savedSet').get()).exists, false); assert.equal((await quota(buyer, 'notificationsRead').get()).exists, false);
});
