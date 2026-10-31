import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketHandler } from '../lib/server/market-handler.mjs';
import { RateLimitError } from '../lib/server/limits.mjs';
import { requestTrace } from '../lib/server/telemetry.mjs';
const actor={uid:'private-user-id',email:'private-email@emory.edu',email_verified:true};
const request=(body,headers={Authorization:'Bearer private-credential'})=>new Request('http://localhost/api/market?private-query=secret',{method:'POST',headers,body});
function harness({verified=actor,run=async()=>({id:'ok'}),consume=async()=>{}}={}) {
 const logs=[];
 const handler=createMarketHandler({backend:()=>({db:{},auth:{verifyIdToken:async()=>verified}}),run,consume,log:entry=>logs.push(entry)});
 return {handler,logs};
}
const normal=JSON.stringify({action:'message',data:{text:'private-message',requestId:'private-client-id'}});
test('success has correlation and no-store headers; logs contain only projected metadata',async()=>{
 const {handler,logs}=harness(),response=await handler(request(normal)),body=await response.json();
 assert.equal(response.status,200);assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.equal(body.requestId,response.headers.get('x-request-id'));assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(Object.keys(logs[0]).sort(),['durationMs','event','operation','requestId','route','status'].sort());assert.equal(logs[0].operation,'message');assert(!JSON.stringify(logs).includes('private-'));
});
test('unexpected errors return a reference and never expose exception messages, stacks or codes',async()=>{
 const {handler,logs}=harness({run:async()=>{throw Object.assign(new Error('private-body-and-token'),{code:'private-error-code',response:{password:'private-password'}})}});
 const response=await handler(request(JSON.stringify({action:'private-malicious-operation',data:{}}))),body=await response.json();
 assert.equal(response.status,500);assert(body.error.includes(body.requestId));assert.equal(logs[0].operation,'unknown');assert.equal(logs[0].failure,'internal');assert(!JSON.stringify([body,logs]).includes('private-'));
});
test('429 includes retry instructions and skips the operation',async()=>{
 let ran=false;const {handler}=harness({consume:async()=>{throw new RateLimitError(42)},run:async()=>{ran=true}});
 const response=await handler(request(normal)),body=await response.json();assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'42');assert.equal(body.retryAfterSeconds,42);assert.equal(ran,false);
});
test('malformed and oversized verified requests debit attempt quota but never run operations',async()=>{
 let debits=0,runs=0;const {handler}=harness({consume:async()=>{debits++},run:async()=>{runs++}});
 for(const [body,status] of [['{broken',400],[JSON.stringify({data:[]}),400],[JSON.stringify({data:{text:'🧑'.repeat(4000)}}),413]])assert.equal((await handler(request(body))).status,status);
 assert.equal((await handler(request('{}',{Authorization:'Bearer test','content-length':'12001'}))).status,413);
 assert.equal(debits,4);assert.equal(runs,0);
});
test('anonymous, invalid-token, unverified and unsupported accounts do not allocate quotas',async()=>{
 let debits=0;const consume=async()=>{debits++};
 assert.equal((await harness({consume}).handler(request(normal,{}))).status,401);
 for(const verified of [{...actor,email_verified:false},{...actor,email:'other@gmail.com'}])assert.equal((await harness({consume,verified}).handler(request(normal))).status,403);
 const handler=createMarketHandler({backend:()=>({auth:{verifyIdToken:async()=>{throw Error('private-token')}}}),consume,log:()=>{}});
 assert.equal((await handler(request(normal))).status,401);assert.equal(debits,0);
});
test('independent requests receive server IDs regardless of client headers',async()=>{
 const {handler}=harness();const ids=[];
 for(let i=0;i<2;i++)ids.push((await handler(request(normal,{Authorization:'Bearer test','X-Request-ID':'client-controlled'}))).headers.get('x-request-id'));
 assert.notEqual(ids[0],ids[1]);assert.notEqual(ids[0],'client-controlled');
});
test('photo/upload errors use the same safe projection; logger failure cannot change a committed response',()=>{
 for(const route of ['photo','upload']) {
  const logs=[],trace=requestTrace(route,r=>logs.push(r));
  const response=trace.finish(new Response(null,{status:503}),{error:{code:'UNAVAILABLE',message:'private-image-url',stack:'private-token'}});
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(logs[0].failure,'UNAVAILABLE');assert(!JSON.stringify(logs).includes('private-'));
 }
 assert.equal(requestTrace('market',()=>{throw Error('logger unavailable')}).finish(new Response(null,{status:200})).status,200);
});

test('long waits are readable while exact retry seconds remain available',()=>{
 const error=new RateLimitError(28196,'listingCreate');
 assert.equal(error.message,'Listing limit reached. Try again in about 8 hours.');assert.equal(error.retryAfterSeconds,28196);
 assert.equal(new RateLimitError(60,'message').message,'Messaging limit reached. Try again in about 1 minute.');
});
