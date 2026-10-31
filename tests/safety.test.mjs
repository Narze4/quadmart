import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { operate } from '../lib/server/market.mjs';
import { authorizePhoto, uploadPhoto } from '../lib/server/uploads.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Local emulator required');
const app=initializeApp({projectId:'demo-quadmart'},'safety-tests'), db=getFirestore(app);
const seller={uid:'seller',email:'seller@emory.edu',email_verified:true}, buyer={uid:'buyer',email:'buyer@emory.edu',email_verified:true}, admin={uid:'moderator',email:'moderator@emory.edu',email_verified:true}, outsider={uid:'outsider',email:'outsider@uga.edu',email_verified:true};
const api=(actor,action,data={})=>operate(db,actor,action,data);
const denied=status=>e=>e.status===status;
const report=(overrides={})=>({targetType:'listing',targetId:'desk',reason:'scam',details:'Development safety test report.',requestId:crypto.randomUUID(),...overrides});
const decide=(reportId,decision,version=0)=>api(admin,'moderate',{reportId,decision,version,note:'Reviewed synthetic test evidence.'});
const listing={title:'Test desk',description:'Synthetic listing',price:30,category:'Product',condition:'Good',images:[],imageIds:[],sellerUid:'seller',sellerEmail:seller.email,campusId:'emory.edu',status:'active',createdAt:new Date()};
beforeEach(async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents',{method:'DELETE'});
 for(const actor of [seller,buyer,admin,outsider]) await api(actor,'profile',{displayName:actor.uid});
 await db.doc('moderators/moderator').set({active:true,campusIds:['emory.edu']});
 await db.doc('listings/desk').set(listing);
});
after(async()=>{await db.terminate();await deleteApp(app)});
test('report derives owner/campus, preserves evidence and deduplicates retries/open targets',async()=>{
 const c=await api(buyer,'conversation',{listingId:'desk'});
 await api(seller,'message',{conversationId:c.id,text:'Synthetic evidence',requestId:'message-1'});
 const data=report({conversationId:c.id,targetUid:'moderator',campusId:'uga.edu'});
 const [a,b]=await Promise.all([api(buyer,'report',data),api(buyer,'report',data)]);assert.equal(a.id,b.id);
 assert.equal((await api(buyer,'report',report())).id,a.id);
 const stored=(await db.doc(`reports/${a.id}`).get()).data();assert.equal(stored.targetUid,'seller');assert.equal(stored.campusId,'emory.edu');assert.equal(stored.evidence[0].text,'Synthetic evidence');
 assert.equal((await db.doc('reportLimits/buyer').get()).data().count,1);
 await assert.rejects(api(buyer,'report',{...data,details:'Altered report contents'}),denied(409));
});
test('self, foreign-campus and forged conversation evidence reports fail',async()=>{
 await assert.rejects(api(seller,'report',report()),denied(400));
 await assert.rejects(api(outsider,'report',report()),denied(404));
 const c=await api(admin,'conversation',{listingId:'desk'});
 await assert.rejects(api(buyer,'report',report({conversationId:c.id})),denied(403));
});
test('report budget is shared across concurrent requests and resets by UTC day',async()=>{
 for(let i=0;i<7;i++)await db.doc(`listings/item${i}`).set(listing);
 const outcomes=await Promise.allSettled(Array.from({length:7},(_,i)=>api(buyer,'report',report({targetId:`item${i}`}))));
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,5);
 assert(outcomes.filter(x=>x.status==='rejected').every(x=>x.reason.status===429));
 await db.doc('reportLimits/buyer').set({day:0,count:99});
 await api(buyer,'report',report());
});
test('blocks prevent existing/new conversations and messages in both directions',async()=>{
 const c=await api(buyer,'conversation',{listingId:'desk'});
 await api(buyer,'block',{targetUid:'seller',blocked:true});
 for(const actor of [buyer,seller]) await assert.rejects(api(actor,'message',{conversationId:c.id,text:'Blocked',requestId:crypto.randomUUID()}),denied(403));
 await assert.rejects(api(buyer,'conversation',{listingId:'desk'}),denied(403));
 await assert.rejects(api(seller,'sale',{listingId:'desk',buyerUid:'buyer'}),denied(403));
 await assert.rejects(api(seller,'block',{targetUid:'outsider',blocked:true}),denied(404));
 await api(buyer,'block',{targetUid:'seller',blocked:false});
 await api(seller,'message',{conversationId:c.id,text:'Allowed after unblock',requestId:crypto.randomUUID()});
});
test('only the blocker can remove their block',async()=>{
 await api(buyer,'block',{targetUid:'seller',blocked:true});
 await api(seller,'block',{targetUid:'buyer',blocked:false});
 assert.equal((await api(seller,'blockStatus',{targetUid:'buyer'})).contactUnavailable,true);
 assert.equal((await api(seller,'safetyOverview')).blocks.length,0);
});
test('moderation role cannot come from user fields or token claims',async()=>{
 const r=await api(buyer,'report',report());
 await db.doc('users/buyer').update({isAdmin:true,role:'moderator'});
 for(const action of ['moderationQueue','moderate'])await assert.rejects(api({...buyer,admin:true,moderator:true},action,{reportId:r.id,decision:'suspend',version:0,note:'Malicious self promotion'}),denied(403));
 await db.doc('moderators/outsider').set({active:true,campusIds:['emory.edu']});
 await assert.rejects(api(outsider,'moderationQueue'),denied(403));
});
test('removal archives listing, hides photos and restoration preserves original contents',async()=>{
 const photoId='a'.repeat(64);await db.doc(`media/${photoId}`).set({status:'ready',ownerUid:'seller',campusId:'emory.edu'});
 await db.doc('listings/desk').update({imageIds:[photoId],images:[`/api/photos/${photoId}`]});
 const r=await api(buyer,'report',report());
 await decide(r.id,'removeListing');
 assert.equal((await db.doc('listings/desk').get()).exists,false);
 assert.equal((await db.doc('removedListings/desk').get()).data().listing.title,listing.title);
 const photoRequest=new Request('http://localhost',{headers:{Authorization:'Bearer test'}});
 await assert.rejects(authorizePhoto(photoRequest,photoId,{db,auth:{verifyIdToken:async()=>buyer}}),denied(404));
 assert.equal((await authorizePhoto(photoRequest,photoId,{db,auth:{verifyIdToken:async()=>admin}})).status,'blocked');
 await decide(r.id,'restoreListing',1);
 assert.equal((await db.doc('listings/desk').get()).data().title,listing.title);
 assert.equal((await authorizePhoto(photoRequest,photoId,{db,auth:{verifyIdToken:async()=>buyer}})).status,'ready');
 assert.equal((await db.collection('moderationEvents').get()).size,2);
});
test('overlapping removals do not restore a photo still under another removal',async()=>{
 const photoId='b'.repeat(64);await db.doc(`media/${photoId}`).set({status:'ready',ownerUid:'seller',campusId:'emory.edu'});
 for(const lid of ['desk','desk2'])await db.doc(`listings/${lid}`).set({...listing,imageIds:[photoId],images:[`/api/photos/${photoId}`]});
 const a=await api(buyer,'report',report()),b=await api(buyer,'report',report({targetId:'desk2'}));
 await decide(a.id,'removeListing');await decide(b.id,'removeListing');await decide(a.id,'restoreListing',1);
 assert.equal((await db.doc(`media/${photoId}`).get()).data().status,'blocked');
 await decide(b.id,'restoreListing',1);assert.equal((await db.doc(`media/${photoId}`).get()).data().status,'ready');
});
test('stale decisions and self moderation are denied; resolved report can be reported again',async()=>{
 const r=await api(buyer,'report',report());await decide(r.id,'dismiss');
 await assert.rejects(decide(r.id,'suspend'),denied(409));
 const another=await api(buyer,'report',report());assert.notEqual(r.id,another.id);
 const own=await api(buyer,'report',report({targetType:'user',targetId:'moderator'}));await assert.rejects(decide(own.id,'suspend'),denied(403));
});
test('suspension blocks market, uploads and photos with existing verified actor; reinstatement works',async()=>{
 const r=await api(buyer,'report',report({targetType:'user',targetId:'seller'}));await decide(r.id,'suspend');
 for(const action of ['profile','safetyOverview','report','block'])await assert.rejects(api(seller,action,{}),denied(403));
 const request=new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'image/jpeg','X-Upload-Id':'x'.repeat(20)},body:'test'});
 await assert.rejects(uploadPhoto(request,{db,auth:{verifyIdToken:async()=>seller},projectId:'demo-quadmart'}),denied(403));
 const photoId='c'.repeat(64);await db.doc(`media/${photoId}`).set({status:'ready',ownerUid:'seller',campusId:'emory.edu'});
 await assert.rejects(authorizePhoto(new Request('http://localhost',{headers:{Authorization:'Bearer test'}}),photoId,{db,auth:{verifyIdToken:async()=>buyer}}),denied(403));
 await decide(r.id,'reinstate',1);await api(seller,'profile');
});
test('role revocation takes effect without refreshing an ID token',async()=>{
 await api(buyer,'report',report());assert.equal((await api(admin,'moderationQueue')).reports.length,1);
 await db.doc('moderators/moderator').update({active:false});await assert.rejects(api(admin,'moderationQueue'),denied(403));
});
