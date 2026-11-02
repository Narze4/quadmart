import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { operate } from '../lib/server/market.mjs';
import { advanceAccountClosure, reconcileAccountClosure, queueMissingAuthAccount } from '../lib/server/account-closure.mjs';
import { cleanMedia, mediaCleanupPage, MEDIA_GRACE_MS } from '../lib/server/media-cleanup.mjs';
import { uploadPhoto, authorizePhoto } from '../lib/server/uploads.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Local Firestore emulator required');
const app=initializeApp({projectId:'demo-quadmart'},'cleanup-tests'),db=getFirestore(app);
const seller={uid:'seller',email:'seller@emory.edu',email_verified:true},buyer={uid:'buyer',email:'buyer@emory.edu',email_verified:true},mod={uid:'mod',email:'mod@emory.edu',email_verified:true};
const fresh=who=>({...who,auth_time:Math.floor(Date.now()/1000)});
const api=(who,action,data={})=>operate(db,who,action,data);
const close=who=>api(fresh(who),'accountClose',{confirmation:'DELETE'});
const denied=status=>e=>e.status===status;
const input=extra=>({title:'Cleanup fixture',description:'Synthetic',price:0,category:'Product',condition:'Good',imageIds:[],requestId:randomUUID(),...extra});
const hash=v=>createHash('sha256').update(v).digest('hex');
const mediaId='a'.repeat(64);
const asset=(id=mediaId,extra={})=>({ownerUid:'seller',campusId:'emory.edu',publicId:`quadmart/demo-quadmart/${hash('seller').slice(0,24)}/${id}`,digest:'synthetic',status:'ready',url:`/api/photos/${id}`,createdAt:new Date(Date.now()-MEDIA_GRACE_MS-1000),...extra});
const seedMedia=(id=mediaId,extra)=>db.doc(`media/${id}`).set(asset(id,extra));
const destroyImage=async()=>({result:'ok'});
const cleanup=(id=mediaId,extra={})=>cleanMedia(db,id,{projectId:'demo-quadmart',apply:true,destroyImage,...extra});
async function drain(uid){for(let n=0;n<30;n++){const s=await advanceAccountClosure(db,uid);if(s.readyForAuthDeletion)return s}throw Error('Job did not converge')}
beforeEach(async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents',{method:'DELETE'});
 for(const who of [seller,buyer,mod])await api(who,'profile',{displayName:who.uid});
 await db.doc('moderators/mod').set({active:true,campusIds:['emory.edu']});
});
after(async()=>{await db.terminate();await deleteApp(app)});
test('deletion requires recent authentication, explicit confirmation and self scope',async()=>{
 for(const who of [seller,{...seller,auth_time:Date.now()/1000-301},{...seller,auth_time:Date.now()/1000+100}])await assert.rejects(api(who,'accountClose',{confirmation:'DELETE'}),denied(401));
 await assert.rejects(api(fresh(seller),'accountClose',{}),denied(400));
 await assert.rejects(api(fresh(seller),'accountClose',{confirmation:'DELETE',uid:'buyer'}),denied(400));
 await assert.rejects(api({...fresh(seller),email_verified:false},'accountClose',{confirmation:'DELETE'}),denied(403));
 await assert.rejects(api(fresh(seller),'accountCloseStep'),denied(409));
 assert.equal((await db.collection('accountDeletions').get()).size,0);
});
test('moderators cannot delete their role; duplicate close requests redact once and retain aggregates',async()=>{
 await assert.rejects(close(mod),denied(409));
 await db.doc('publicProfiles/seller').update({email:'private@emory.edu',customSecret:'remove',sellerRatingSum:5,sellerReviewCount:1,sellerScore:100});
 const [a,b]=await Promise.all([close(seller),close(seller)]);assert.equal(a.phase,b.phase);
 const profile=(await db.doc('publicProfiles/seller').get()).data();assert.equal(profile.displayName,'Deleted student');assert.equal(profile.email,undefined);assert.equal(profile.customSecret,undefined);assert.equal(profile.sellerRatingSum,5);
 await assert.rejects(api(seller,'profile'),denied(403));await assert.rejects(api(seller,'listingCreate',input()),denied(403));
 assert.equal((await db.collection('accountDeletions').get()).size,1);
});
test('batched cleanup resumes and preserves the other account, trade, review, chat and evidence',async()=>{
 const batch=db.batch();
 for(let i=0;i<61;i++)batch.set(db.doc(`listings/l${i}`),{sellerUid:'seller',campusId:'emory.edu',status:i===0?'sold':'active'});
 for(let i=0;i<27;i++){batch.set(db.doc(`notifications/n${i}`),{userId:'seller'});batch.set(db.doc(`conversations/c${String(i).padStart(2,'0')}`),{participants:['seller','buyer'],participantNames:['Original name','Buyer'],lastMessage:'Retained history'});}
 batch.set(db.doc('users/seller/blocks/buyer'),{targetUid:'buyer'});batch.set(db.doc('transactions/t'),{sellerUid:'seller',buyerUid:'buyer',price:30});batch.set(db.doc('publicProfiles/seller/reviews/r'),{rating:5});batch.set(db.doc('reports/r'),{targetUid:'seller',snapshot:{imageIds:[mediaId]}});batch.set(db.doc('listings/buyer-owned'),{sellerUid:'buyer'});batch.set(db.doc('notifications/buyer-owned'),{userId:'buyer'});await batch.commit();
 await close(seller);await advanceAccountClosure(db,'seller');assert.equal((await db.collection('listings').where('sellerUid','==','seller').get()).size,36);
 await Promise.all([advanceAccountClosure(db,'seller'),advanceAccountClosure(db,'seller')]);await drain('seller');
 for(const path of ['users/seller','users/seller/blocks/buyer'])assert.equal((await db.doc(path).get()).exists,false);
 assert.equal((await db.collection('notifications').get()).size,1);assert.equal((await db.collection('listings').get()).size,1);
 for(const path of ['users/buyer','transactions/t','publicProfiles/seller/reviews/r','reports/r'])assert.equal((await db.doc(path).get()).exists,true);
 const chats=await db.collection('conversations').get();assert.equal(chats.size,27);assert(chats.docs.every(c=>c.data().participantNames[0]==='Deleted student'&&c.data().participantNames[1]==='Buyer'));
 let deletes=0;const auth={deleteUser:async uid=>{assert.equal(uid,'seller');deletes++}};
 await reconcileAccountClosure(db,auth,'seller');await reconcileAccountClosure(db,auth,'seller');assert.equal(deletes,1);assert.equal((await db.doc('accountLifecycle/seller').get()).data().closed,true);
});
test('Auth deletion failures leave a resumable job; already-deleted login is successful',async()=>{
 await close(seller);await drain('seller');
 await assert.rejects(reconcileAccountClosure(db,{deleteUser:async()=>{throw Error('unavailable')}},'seller'));
 assert.equal((await db.doc('accountDeletions/seller').get()).data().phase,'auth');
 await reconcileAccountClosure(db,{deleteUser:async()=>{throw Object.assign(Error(),{code:'auth/user-not-found'})}},'seller');
 assert.equal((await db.doc('accountDeletions/seller').get()).data().phase,'complete');
});
test('old sessions cannot send, sell, publish or read photos after closure; moderator cannot restore closed listings',async()=>{
 await seedMedia();const l=await api(seller,'listingCreate',input({imageIds:[mediaId]})),c=await api(buyer,'conversation',{listingId:l.id});
 const report=await api(buyer,'report',{targetType:'listing',targetId:l.id,reason:'other',details:'Synthetic deletion evidence',requestId:randomUUID()});
 await api(mod,'moderate',{reportId:report.id,decision:'removeListing',version:0,note:'Synthetic removal before closure'});
 await close(seller);
 await assert.rejects(api(buyer,'message',{conversationId:c.id,text:'Cannot contact closed account',requestId:randomUUID()}),denied(403));
 await assert.rejects(api(seller,'sale',{listingId:l.id,buyerUid:'buyer'}),denied(403));
 await assert.rejects(api(mod,'moderate',{reportId:report.id,decision:'restoreListing',version:1,note:'Attempt restoration after closure'}),denied(409));
 await assert.rejects(authorizePhoto(new Request('http://localhost',{headers:{Authorization:'Bearer token'}}),mediaId,{db,auth:{verifyIdToken:async()=>seller}}),denied(403));
});
test('listing creation racing account closure leaves no listing after cleanup',async()=>{
 const results=await Promise.allSettled([api(seller,'listingCreate',input()),close(seller)]);
 assert.equal(results[1].status,'fulfilled');if(results[0].status==='rejected')assert.equal(results[0].reason.status,403);
 await drain('seller');assert.equal((await db.collection('listings').get()).size,0);
});
test('missing-Auth reconciliation is dry-run by default and never interprets network failure as deletion',async()=>{
 assert.equal((await queueMissingAuthAccount(db,{getUser:async()=>({uid:'seller'})},'seller',{apply:true})).outcome,'login_exists');
 await assert.rejects(queueMissingAuthAccount(db,{getUser:async()=>{throw Error('network')}},'seller',{apply:true}));
 const missing={getUser:async()=>{throw Object.assign(Error(),{code:'auth/user-not-found'})}};
 assert.equal((await queueMissingAuthAccount(db,missing,'seller')).outcome,'would_queue');assert.equal((await db.doc('accountDeletions/seller').get()).exists,false);
 assert.equal((await queueMissingAuthAccount(db,missing,'seller',{apply:true})).outcome,'queued');
});
test('media dry run does not mutate registry or call storage',async()=>{
 await seedMedia();let calls=0;
 assert.equal((await cleanup(mediaId,{apply:false,destroyImage:async()=>{calls++}})).outcome,'would_delete');assert.equal(calls,0);assert.equal((await db.doc(`media/${mediaId}`).get()).data().status,'ready');
});
test('recent, malformed, outside-project and blocked media are never deleted',async()=>{
 let calls=0;const options={destroyImage:async()=>{calls++}};
 for(const extra of [{createdAt:new Date()},{createdAt:null},{publicId:'quadmart/quadmart-4410f/other'},{ownerUid:''},{status:'blocked'}]){await seedMedia(mediaId,extra);assert.notEqual((await cleanup(mediaId,options)).outcome,'deleted');}
 await assert.rejects(cleanup(mediaId,{projectId:'quadmart-4410f'}));assert.equal(calls,0);
});
test('live listings, archives and resolved report evidence each protect photos',async()=>{
 for(const [path,data] of [['listings/l',{imageIds:[mediaId]}],['removedListings/l',{listing:{imageIds:[mediaId]}}],['reports/r',{status:'resolved',snapshot:{imageIds:[mediaId]}}]]){
  await seedMedia();await db.doc(path).set(data);assert.equal((await cleanup()).outcome,'referenced');await db.doc(path).delete();
 }
});
test('provider failure stays claimed; retry confirms deletion and preserves the retry tombstone',async()=>{
 await seedMedia();await assert.rejects(cleanup(mediaId,{destroyImage:async()=>{throw Error('timeout')}}));
 assert.equal((await db.doc(`media/${mediaId}`).get()).data().status,'deleting');
 await assert.rejects(api(seller,'listingCreate',input({imageIds:[mediaId]})),denied(400));
 assert.equal((await cleanup(mediaId,{destroyImage:async()=>({result:'not found'})})).outcome,'deleted');
 assert.equal((await cleanup()).outcome,'already_deleted');const a=(await db.doc(`media/${mediaId}`).get()).data();assert.equal(a.digest,'synthetic');assert.equal(a.url,undefined);
});
test('unknown provider result never marks deletion complete',async()=>{
 await seedMedia();await assert.rejects(cleanup(mediaId,{destroyImage:async()=>({result:'unexpected'})}));assert.equal((await db.doc(`media/${mediaId}`).get()).data().status,'deleting');
});
test('two cleanup workers can safely retry the same provider delete',async()=>{
 await seedMedia();let calls=0;const destroyImage=async()=>{calls++;return{result:calls===1?'ok':'not found'}};
 const results=await Promise.all([cleanup(mediaId,{destroyImage}),cleanup(mediaId,{destroyImage})]);assert(results.every(x=>['deleted','already_deleted'].includes(x.outcome)));assert.equal((await db.doc(`media/${mediaId}`).get()).data().status,'deleted');
});
test('publication racing cleanup either protects its photo or refuses the listing',async()=>{
 await seedMedia();const [listing,clean]=await Promise.allSettled([api(seller,'listingCreate',input({imageIds:[mediaId]})),cleanup()]);
 assert.equal(clean.status,'fulfilled');
 if(listing.status==='fulfilled'){assert.equal(clean.value.outcome,'referenced');assert.equal((await db.doc(`media/${mediaId}`).get()).data().status,'ready');}
 else{assert.equal(listing.reason.status,400);assert.equal(clean.value.outcome,'deleted');}
});
test('upload finishing after closure cannot publish a ready asset',async()=>{
 const bytes=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();
 const request=new Request('http://localhost',{method:'POST',body:bytes,headers:{Authorization:'Bearer token','Content-Type':'image/png','X-Upload-ID':randomUUID()}});
 await assert.rejects(uploadPhoto(request,{auth:{verifyIdToken:async()=>seller},db,projectId:'demo-quadmart',storeImage:async(b,publicId)=>{
  await close(seller);return{secure_url:`https://res.cloudinary.com/test/image/authenticated/${publicId}.jpg`,public_id:publicId,asset_folder:'quadmart/demo-quadmart',resource_type:'image',type:'authenticated',format:'jpg'};
 }}),denied(403));
 const rows=await db.collection('media').get();assert.equal(rows.size,1);assert.equal(rows.docs[0].data().status,'failed');
});
test('media scan cursor visits tied timestamps without starving later assets',async()=>{
 const createdAt=new Date(Date.now()-MEDIA_GRACE_MS-1000),batch=db.batch();
 for(let i=0;i<30;i++){const id=i.toString(16).padStart(64,'0');batch.set(db.doc(`media/${id}`),asset(id,{createdAt}));}await batch.commit();
 const first=await mediaCleanupPage(db,{projectId:'demo-quadmart'}),second=await mediaCleanupPage(db,{projectId:'demo-quadmart',cursor:first.nextCursor});
 assert.equal(first.results.length,25);assert.equal(second.results.length,5);assert.equal(new Set([...first.results,...second.results].map(r=>r.id)).size,30);assert.equal(second.nextCursor,null);
});
