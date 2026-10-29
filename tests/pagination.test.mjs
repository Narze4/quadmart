import fs from 'node:fs/promises';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment,assertFails } from '@firebase/rules-unit-testing';
import { doc,setDoc,writeBatch,Timestamp } from 'firebase/firestore';
import { marketplaceFeed,conversationFeed,messageFeed,compareMessages } from '../lib/feed-queries.mjs';
let env,db;
const defaults={category:'All',condition:'',search:'',sort:'newest',minPrice:'',maxPrice:''};
before(async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Local emulator required');
 env=await initializeTestEnvironment({projectId:'demo-quadmart',firestore:{rules:await fs.readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});await env.clearFirestore();
 db=env.authenticatedContext('pager',{email:'pager@emory.edu',email_verified:true}).firestore();
 await env.withSecurityRulesDisabled(async ctx=>{
 const admin=ctx.firestore(),batch=writeBatch(admin),createdAt=Timestamp.fromMillis(1793200000000);
 batch.set(doc(admin,'users/pager'),{uid:'pager',campusId:'emory.edu'});
 for(let i=0;i<135;i++)batch.set(doc(admin,`listings/${String(i).padStart(4,'0')}`),{campusId:i===134?'uga.edu':'emory.edu',sellerUid:'seller',status:i===133?'sold':'active',category:i%2?'Product':'Service',condition:i%3?'Good':'New',title:i===0?'Rare oldest bicycle':`Desk ${i}`,price:i,createdAt});
 for(let i=0;i<65;i++)batch.set(doc(admin,`conversations/${String(i).padStart(4,'0')}`),{participants:['pager','seller'],campusId:'emory.edu',lastMessageAt:createdAt,createdAt});
 for(let i=0;i<65;i++)batch.set(doc(admin,`conversations/0000/messages/${String(i).padStart(4,'0')}`),{text:`message ${i}`,senderUid:'seller',createdAt});
 await batch.commit();
 });
});
after(async()=>await env?.cleanup());
async function allPages(load){let cursor=null,rows=[],page;do{page=await load(cursor);rows.push(...page.items);assert.notEqual(page.cursor,cursor);cursor=page.cursor;}while(page.hasMore);return rows;}
test('campus feed traverses past 100 with tied timestamps and no duplicates or foreign/sold records',async()=>{
 const rows=await allPages(marketplaceFeed(db,'emory.edu',defaults));assert.equal(rows.length,133);assert.equal(new Set(rows.map(r=>r.id)).size,133);assert.equal(rows[0].id,'0132');assert.equal(rows.at(-1).id,'0000');
});
test('price order applies across pages, with category/condition filters and price range',async()=>{
 const rows=await allPages(marketplaceFeed(db,'emory.edu',{...defaults,sort:'price-asc',category:'Product',condition:'Good',minPrice:'10',maxPrice:'100'}));
 assert(rows.length>24);assert(rows.every(x=>x.category==='Product'&&x.condition==='Good'&&x.price>=10&&x.price<=100));assert.deepEqual(rows.map(x=>x.price),[...rows.map(x=>x.price)].sort((a,b)=>a-b));
 const descending=await marketplaceFeed(db,'emory.edu',{...defaults,sort:'price-desc'})(null);assert.equal(descending.items[0].price,132);
});
test('rare substring search advances empty batches and reaches an older-than-100 match',async()=>{
 const load=marketplaceFeed(db,'emory.edu',{...defaults,search:'oldest bicycle'});const first=await load(null);assert.equal(first.items.length,0);assert.equal(first.hasMore,true);const second=await load(first.cursor);assert.deepEqual(second.items.map(x=>x.id),['0000']);assert.equal(second.hasMore,false);
});
test('inbox and message history paginate tied timestamps without gaps',async()=>{
 const inbox=await allPages(conversationFeed(db,'pager').loadPage),messages=await allPages(messageFeed(db,'0000').loadPage);assert.equal(inbox.length,65);assert.equal(messages.length,65);assert.equal(new Set(messages.map(x=>x.id)).size,65);assert.deepEqual([...messages].sort(compareMessages).map(x=>x.id),messages.map(x=>x.id));
});
test('paged queries retain campus/participant authorization and reject invalid prices',async()=>{
 const outsider=env.authenticatedContext('outsider',{email:'outsider@emory.edu',email_verified:true}).firestore();
 await assertFails(messageFeed(outsider,'0000').loadPage(null));await assertFails(conversationFeed(outsider,'pager').loadPage(null));await assertFails(marketplaceFeed(db,'uga.edu',defaults)(null));
 await assert.rejects(marketplaceFeed(db,'emory.edu',{...defaults,minPrice:'100',maxPrice:'10'})(null));
});
test('live queries receive new messages while keeping the head bounded',async()=>{
 const events=[];let receive;const ready=new Promise(resolve=>{receive=resolve;});
 const stop=messageFeed(db,'0000').watch(page=>{events.push(page);if(page.items[0]?.id==='new')receive();},receive);
 try{await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'conversations/0000/messages/new'),{senderUid:'seller',text:'new',createdAt:Timestamp.now()}));await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('listener timeout')),5000))]);assert.equal(events.at(-1).items.length,30);assert.equal(events.at(-1).items[0].id,'new');}finally{stop();}
});
