import test from 'node:test';
import assert from 'node:assert/strict';
import { createCursorFeed } from '../lib/cursor-feed.mjs';
const item=id=>({id:String(id),cursor:String(id),value:id});
const page=(ids,hasMore=true)=>({items:ids.map(item),cursor:String(ids.at(-1)),hasMore});
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('failed next page preserves data/cursor; retry deduplicates and cannot run twice',async()=>{
 let calls=0;const gate=deferred();const cursors=[];
 const feed=createCursorFeed({loadPage:async cursor=>{cursors.push(cursor);calls++;if(calls===1)return page([3,2]);if(calls===2)throw Error();return gate.promise;}});
 feed.start();await tick();await feed.load();assert.deepEqual(feed.getSnapshot().items.map(x=>x.id),['3','2']);assert.equal(feed.getSnapshot().cursor,'2');
 const request=feed.load();await feed.load();assert.equal(calls,3);gate.resolve(page([2,1],false));await request;assert.deepEqual(feed.getSnapshot().items.map(x=>x.id),['3','2','1']);assert.equal(feed.getSnapshot().hasMore,false);assert.deepEqual(cursors,[null,'2','2']);
});
test('unmount and Strict Mode restart ignore the obsolete pending response',async()=>{
 const a=deferred(),b=deferred();let calls=0;
 const feed=createCursorFeed({loadPage:()=>++calls===1?a.promise:b.promise});feed.start();feed.dispose();feed.start();a.resolve(page([99]));await tick();assert.equal(feed.getSnapshot().items.length,0);b.resolve(page([1],false));await tick();assert.equal(feed.getSnapshot().items[0].id,'1');
});
test('an empty filtered page still advances its continuation cursor',async()=>{
 let calls=0;const feed=createCursorFeed({loadPage:async cursor=>{calls++;if(!cursor)return {items:[],cursor:'scanned',hasMore:true};return page([1],false);}});feed.start();await tick();assert.equal(feed.getSnapshot().hasMore,true);await feed.load();assert.equal(calls,2);assert.equal(feed.getSnapshot().items.length,1);
});
test('moving live head merges with loaded history, updates rows and stays bounded',async()=>{
 let receive;const feed=createCursorFeed({pageSize:2,compare:(a,b)=>b.value-a.value,watch:cb=>{receive=cb;return()=>{};},loadPage:async()=>page([2,1],false)});feed.start();receive(page([4,3]));await feed.load();receive(page([5,4]));assert.deepEqual(feed.getSnapshot().items.map(x=>x.id),['5','4','3','2']);assert.equal(feed.getSnapshot().cursor,'2');assert.equal(feed.getSnapshot().hasMore,true);
 receive({...page([5,4]),items:[{...item(5),text:'updated'},item(4)]});assert.equal(feed.getSnapshot().items[0].text,'updated');
});
test('a disconnected live burst resets to a contiguous window and discards stale history requests',async()=>{
 let receive;const gate=deferred();const feed=createCursorFeed({pageSize:2,compare:(a,b)=>b.value-a.value,watch:cb=>{receive=cb;return()=>{};},loadPage:async()=>gate.promise});feed.start();receive(page([4,3]));const pending=feed.load();receive(page([8,7]));gate.resolve(page([2,1],false));await pending;assert.deepEqual(feed.getSnapshot().items.map(x=>x.id),['8','7']);assert.equal(feed.getSnapshot().cursor,'7');assert.equal(feed.getSnapshot().hasMore,true);
});
test('permission failures clear retained private content and ignore later listener data',()=>{
 let receive,fail;const feed=createCursorFeed({watch:(a,b)=>{receive=a;fail=b;return()=>{};},loadPage:async()=>page([])});feed.start();receive(page([2,1]));fail({code:'permission-denied'});assert.equal(feed.getSnapshot().items.length,0);receive(page([3]));assert.equal(feed.getSnapshot().items.length,0);assert.equal(feed.getSnapshot().denied,true);
});
test('a complete live result removes previously cached records that no longer exist',()=>{
 let receive;const feed=createCursorFeed({watch:cb=>{receive=cb;return()=>{};},loadPage:async()=>page([])});feed.start();receive(page([3,2]));receive(page([3],false));assert.deepEqual(feed.getSnapshot().items.map(x=>x.id),['3']);assert.equal(feed.getSnapshot().hasMore,false);
});
