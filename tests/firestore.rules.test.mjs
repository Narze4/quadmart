import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

const projectId = 'demo-quadmart';
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw new Error('Tests require the local Firestore emulator');
let env;
const auth = (uid = 'alice', email = 'alice@emory.edu', verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const listing = (extra = {}) => ({title:'Desk', description:'Used desk', price:30, category:'Product', condition:'Good', images:[], sellerUid:'alice', sellerEmail:'alice@emory.edu', campusId:'emory.edu', status:'active', createdAt:serverTimestamp(), ...extra});
const conversation = (extra = {}) => ({participants:['bob','alice'], participantEmails:['bob@emory.edu','alice@emory.edu'], listingId:'desk', listingTitle:'Desk', lastMessage:'', createdAt:serverTimestamp(), lastMessageAt:serverTimestamp(), ...extra});
const seed = async (path, data) => env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), data));
before(async () => { env = await initializeTestEnvironment({projectId, firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}}); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed('listings/desk',listing({createdAt:Timestamp.now()}));
  await seed('users/alice',{uid:'alice',email:'alice@emory.edu',campusId:'emory.edu',sellerScore:null,transactions:0});
  await seed('publicProfiles/alice',{displayName:'Alice',campusId:'emory.edu'});
  await seed('conversations/chat',conversation({createdAt:Timestamp.now(),lastMessageAt:Timestamp.now()}));
  await seed('notifications/n',{userId:'alice',read:false,title:'Message'});
  await seed('transactions/t',{sellerUid:'alice',buyerUid:'bob'});
});
for (const [name, uid, email, verified] of [
  ['unverified student','alice','alice@emory.edu',false],
  ['unsupported university','eve','eve@other.edu',true],
  ['ordinary email','eve','eve@gmail.com',true],
  ['lookalike domain','eve','eve@fakeemory.edu',true],
  ['domain suffix attack','eve','eve@emory.edu.attacker.com',true],
]) test(`${name} cannot read or create listings`, async () => {
  const db = auth(uid,email,verified);
  await assertFails(getDoc(doc(db,'listings/desk')));
  await assertFails(setDoc(doc(db,'listings/attempt'),listing({sellerUid:uid,sellerEmail:email})));
});
test('anonymous access is denied', async () => { await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'listings/desk'))); });
test('verified student can read own campus; subdomains share campus', async () => {
  await assertSucceeds(getDoc(doc(auth(),'listings/desk')));
  await assertSucceeds(getDoc(doc(auth('sub','sub@students.emory.edu'),'listings/desk')));
});
test('cross campus reads fail', async () => { await assertFails(getDoc(doc(auth('eve','eve@uga.edu'),'listings/desk'))); });
test('campus-scoped query works; broad query fails', async () => {
  await assertSucceeds(getDocs(query(collection(auth(),'listings'),where('campusId','==','emory.edu'))));
  await assertFails(getDocs(collection(auth(),'listings')));
});
test('direct listing creation cannot bypass server quotas', async () => { await assertFails(setDoc(doc(auth(),'listings/new'),listing())); });
test('status changes require the backend; only the owner may delete an unsold listing', async () => {
  await assertFails(updateDoc(doc(auth(),'listings/desk'),{status:'reserved'}));
  await assertFails(updateDoc(doc(auth('bob','bob@emory.edu'),'listings/desk'),{price:0}));
  await assertFails(deleteDoc(doc(auth('bob','bob@emory.edu'),'listings/desk')));
  await assertSucceeds(deleteDoc(doc(auth(),'listings/desk')));
});
test('seller cannot transfer ownership or complete sale from client', async () => {
  await assertFails(updateDoc(doc(auth(),'listings/desk'),{sellerUid:'bob'}));
  await assertFails(updateDoc(doc(auth(),'listings/desk'),{status:'sold'}));
});
test('private account data is owner-only; public profile is campus-only', async () => {
  await assertSucceeds(getDoc(doc(auth(),'users/alice')));
  await assertFails(getDoc(doc(auth('bob','bob@emory.edu'),'users/alice')));
  await assertSucceeds(getDoc(doc(auth('bob','bob@emory.edu'),'publicProfiles/alice')));
  await assertFails(getDoc(doc(auth('eve','eve@uga.edu'),'publicProfiles/alice')));
});
test('owner can save items but cannot forge campus, score, or transaction count', async () => {
  await assertSucceeds(updateDoc(doc(auth(),'users/alice'),{savedListings:['desk']}));
  for (const field of ['campusId','sellerScore','buyerScore','transactions','email','displayName']) await assertFails(updateDoc(doc(auth(),'users/alice'),{[field]:100}));
  await assertFails(setDoc(doc(auth(),'users/new'),{uid:'new'}));
});
test('direct conversation creates require backend', async () => { await assertFails(setDoc(doc(auth('bob','bob@emory.edu'),'conversations/new'),conversation())); });
test('cannot forge participants, listing, or campus in a conversation', async () => {
  const db=auth('bob','bob@emory.edu');
  await assertFails(setDoc(doc(db,'conversations/new'),conversation({participants:['bob','eve']})));
  await assertFails(setDoc(doc(db,'conversations/new'),conversation({listingId:'missing'})));
  await assertFails(setDoc(doc(auth('bob','bob@uga.edu'),'conversations/new'),conversation({participantEmails:['bob@uga.edu','alice@emory.edu']})));
  await assertFails(updateDoc(doc(db,'conversations/chat'),{participants:['bob','eve']}));
});
test('participants can query inbox and send messages; outsiders cannot', async () => {
  const db=auth('bob','bob@emory.edu');
  await assertSucceeds(getDocs(query(collection(db,'conversations'),where('participants','array-contains','bob'))));
  const path='conversations/chat/messages/m';
  await assertFails(setDoc(doc(db,path),{text:'Hello',senderUid:'bob',createdAt:serverTimestamp()}));
  await seed(path,{text:'Hello',senderUid:'bob',createdAt:Timestamp.now()});
  await assertSucceeds(getDoc(doc(auth(),path)));
  await assertFails(getDoc(doc(auth('eve','eve@emory.edu'),path)));
  await assertFails(setDoc(doc(auth('eve','eve@emory.edu'),path+'2'),{text:'Intrusion',senderUid:'eve',createdAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,path),{text:'Edited'}));
  await assertFails(deleteDoc(doc(db,path)));
});
test('cannot spoof message sender or send oversized messages', async () => {
  const db=auth('bob','bob@emory.edu');
  for (const data of [{text:'Hi',senderUid:'alice'},{text:'x'.repeat(4001),senderUid:'bob'},{text:'',senderUid:'bob'}]) await assertFails(setDoc(doc(db,'conversations/chat/messages/bad'),{...data,createdAt:serverTimestamp()}));
});
test('notification owner can mark read but cannot change content or recipient', async () => {
  await assertSucceeds(updateDoc(doc(auth(),'notifications/n'),{read:true}));
  await assertFails(updateDoc(doc(auth(),'notifications/n'),{title:'Forged'}));
  await assertFails(updateDoc(doc(auth(),'notifications/n'),{userId:'bob'}));
  await assertFails(getDoc(doc(auth('bob','bob@emory.edu'),'notifications/n')));
  await assertFails(setDoc(doc(auth(),'notifications/new'),{userId:'bob',read:false}));
});
test('transaction participants can read; all client writes and fabricated reviews fail', async () => {
  await assertSucceeds(getDoc(doc(auth(),'transactions/t')));
  await assertSucceeds(getDoc(doc(auth('bob','bob@emory.edu'),'transactions/t')));
  await assertFails(getDoc(doc(auth('eve','eve@emory.edu'),'transactions/t')));
  await assertFails(setDoc(doc(auth(),'transactions/new'),{sellerUid:'alice',buyerUid:'bob'}));
  await assertFails(setDoc(doc(auth(),'users/bob/reviews/new'),{reviewerUid:'alice',rating:5}));
});
test('legacy and unknown paths stay denied', async () => {
  await assertFails(setDoc(doc(auth(),'messages/legacy'),{participants:['alice','bob']}));
  await assertFails(setDoc(doc(auth(),'admin/settings'),{enabled:true}));
});

const photoId = 'a'.repeat(64);
const photoUrl = `/api/photos/${photoId}`;
const readyPhoto = (extra = {}) => ({ ownerUid: 'alice', campusId: 'emory.edu', status: 'ready', url: photoUrl, ...extra });
test('client cannot forge media registry or reset upload budgets',async()=>{
  await assertFails(setDoc(doc(auth(),`media/${photoId}`),readyPhoto()));
  await assertFails(setDoc(doc(auth(),'uploadLimits/global'),{daily:0}));
  await seed(`media/${photoId}`,readyPhoto());
  await assertFails(getDoc(doc(auth(),`media/${photoId}`)));
});

test('suspension is enforced for existing authenticated clients across database access',async()=>{
  const db=auth();
  await assertSucceeds(getDoc(doc(db,'listings/desk')));
  await seed('moderationAccounts/alice',{suspended:true,reportId:'private-report'});
  for(const path of ['listings/desk','users/alice','publicProfiles/alice','conversations/chat','transactions/t','notifications/n'])await assertFails(getDoc(doc(db,path)));
  await assertFails(setDoc(doc(db,'listings/new'),listing()));
  await assertFails(updateDoc(doc(db,'listings/desk'),{price:20}));
  await assertFails(deleteDoc(doc(db,'listings/desk')));
  await assertSucceeds(getDoc(doc(db,'moderationAccounts/alice')));
  await assertFails(updateDoc(doc(db,'moderationAccounts/alice'),{suspended:false}));
  await seed('moderationAccounts/alice',{suspended:false});
  await assertSucceeds(getDoc(doc(db,'listings/desk')));
});
test('moderation roles, evidence, reports, archives and block lists are not directly accessible',async()=>{
  const db=auth();
  for(const path of ['moderators/alice','reports/r','removedListings/desk','moderationEvents/e','openReports/r','reportLimits/alice','users/alice/blocks/bob']) {
    await seed(path,{private:'evidence',active:true,campusIds:['emory.edu']});
    await assertFails(getDoc(doc(db,path)));await assertFails(setDoc(doc(db,path),{active:true}));await assertFails(deleteDoc(doc(db,path)));
  }
  await seed('moderationAccounts/bob',{suspended:false});await assertFails(getDoc(doc(db,'moderationAccounts/bob')));
});
test('a removed listing cannot be recreated by its seller',async()=>{
  await seed('removedListings/new',{reportId:'r',listing:listing({createdAt:Timestamp.now()})});
  await assertFails(setDoc(doc(auth(),'listings/new'),listing()));
});
test('operation budgets and listing retry records cannot be read, reset or deleted by clients',async()=>{
  for(const path of ['operationLimits/private','listingRequests/private']) {
    await seed(path,{dayCount:20});
    await assertFails(getDoc(doc(auth(),path)));
    await assertFails(setDoc(doc(auth(),path),{dayCount:0}));
    await assertFails(deleteDoc(doc(auth(),path)));
  }
});
