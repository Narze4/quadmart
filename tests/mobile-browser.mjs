import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { chromium, webkit, devices } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { LIMITS, limitId } from '../lib/server/limits.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Isolated emulators required');
const app=initializeApp({projectId:'demo-quadmart'},'mobile-browser'),db=getFirestore(app),auth=getAuth(app);
const base='http://127.0.0.1:3100',password='Local-only-password-123!',title='Mobile desk '+ 'W'.repeat(80);
const jpeg=await sharp({create:{width:400,height:300,channels:3,background:'#15704f'}}).jpeg().toBuffer();
let checks=0;
const errors=[];
const pass=(browser,scenario)=>{checks++;console.log(JSON.stringify({mobileCheck:checks,browser,scenario}));};
const text=(page,value)=>page.getByText(value,{exact:true}).waitFor();
async function fit(page,label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: horizontal overflow`);}
async function shot(page,name){if(process.env.QUADMART_SCREENSHOT_DIRECTORY){await fs.mkdir(process.env.QUADMART_SCREENSHOT_DIRECTORY,{recursive:true});await page.screenshot({path:path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY,`${name}.png`),animations:'disabled'});}}
async function navigate(page,name){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name,exact:true}).click();}
async function login(page,email){
 // Exercise a cold, slow-JavaScript load: form fields must not accept values
 // before React and the initial Auth state are ready to handle their events.
 const scripts='**/_next/static/**/*.js';let release;
 const ready=new Promise(resolve=>{release=resolve;});
 await page.route(scripts,async route=>{await ready;await route.continue();});
 try{
  await page.goto(base+'/login',{waitUntil:'commit'});
  const input=page.locator('input[type=email]');await input.waitFor();
  assert(await input.isDisabled(),'Login is disabled before hydration');
  assert(await page.getByRole('button',{name:'Log In',exact:true}).isDisabled());
 }finally{release();}
 await page.waitForLoadState('load');await page.unroute(scripts);
 await page.locator('input[type=email]').fill(email);
 await page.locator('input[type=password]').fill(password);
 await page.getByRole('button',{name:'Log In',exact:true}).click();
 await page.waitForURL('**/dashboard');await text(page,'Browse by category');
}
try{
 for(const [engine,device,name] of [[chromium,'Pixel 7','chromium-android'],[webkit,'iPhone 13','webkit-iphone']]){
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents',{method:'DELETE'});
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts',{method:'DELETE'});
  const seller='phone-seller',buyer='phone-buyer';
  for(const uid of [seller,buyer])await auth.createUser({uid,email:`${uid}@emory.edu`,password,displayName:uid,emailVerified:true});
  const browser=await engine.launch({headless:true});
  const sc=await browser.newContext(devices[device]),bc=await browser.newContext(devices[device]);
  const sp=await sc.newPage(),bp=await bc.newPage();
  for(const p of [sp,bp])p.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
  try{
   await login(sp,`${seller}@emory.edu`);await login(bp,`${buyer}@emory.edu`);await fit(sp,'dashboard');
   await sp.setViewportSize({width:320,height:360});await fit(sp,'narrow dashboard');await sp.getByRole('button',{name:'Open menu',exact:true}).click();
   const nav=sp.getByRole('navigation',{name:'Mobile navigation'});await nav.getByRole('button',{name:'Log out',exact:true}).scrollIntoViewIfNeeded();
   const box=await nav.getByRole('button',{name:'Log out',exact:true}).boundingBox();assert(box&&box.y>=0&&box.y+box.height<=360);
   await sp.keyboard.press('Escape');await sp.getByRole('button',{name:'Open menu',exact:true}).waitFor();await sp.setViewportSize(devices[device].viewport);pass(name,'short-screen navigation');
   await sp.route('**/api/upload',route=>route.request().method()==='GET'?route.fulfill({status:200,contentType:'application/json',body:'{"enabled":true}'}):route.continue());
   await navigate(sp,'Sell');await sp.getByRole('button',{name:/^Product/}).click();await sp.getByRole('button',{name:'Next →',exact:true}).click();await text(sp,'Step 2 of 6');
   await sp.locator('input[type=file]').first().setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(3*1024*1024+1)});
   await text(sp,'Choose JPG, PNG, or WebP photos, up to 3 MB each.');assert.equal(await sp.getByRole('button',{name:'Remove photo 1',exact:true}).count(),0);
   await sp.getByRole('button',{name:'Next →',exact:true}).click();await sp.getByRole('textbox',{name:'Listing title',exact:true}).fill(title);
   assert.equal(await sp.getByRole('textbox',{name:'Listing title',exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'16px');
   await sp.getByRole('button',{name:'Next →',exact:true}).click();await sp.getByRole('textbox',{name:'Listing description',exact:true}).fill('Synthetic phone test listing. No real payment or student invitation.');
   await sp.getByRole('button',{name:'Next →',exact:true}).click();await sp.getByPlaceholder('0.00',{exact:true}).fill('25');
   assert.equal(await sp.getByPlaceholder('0.00',{exact:true}).getAttribute('inputmode'),'decimal');await sp.getByRole('button',{name:'Next →',exact:true}).click();await sp.getByRole('button',{name:'Good',exact:true}).click();await fit(sp,'sell');await shot(sp,`${name}-sell`);
   await sp.getByRole('button',{name:'Post Listing',exact:true}).click();await sp.waitForURL('**/my-listings');await text(sp,title);await fit(sp,'my listings');
   const published=await db.collection('listings').get();assert.equal(published.size,1);const listingId=published.docs[0].id;assert.equal((await db.doc(`listings/${listingId}`).get()).data().sellerUid,seller);pass(name,'six-step listing and oversized-photo rejection');
   await navigate(bp,'Marketplace');await bp.getByPlaceholder('Search listings…').fill('Mobile desk');await text(bp,title);await fit(bp,'marketplace');await bp.locator(`a[href="/listing/${listingId}"]`).first().click();await text(bp,title);await fit(bp,'buyer listing');
   await bp.route('**/api/market',route=>route.request().postDataJSON()?.action==='savedSet'?route.abort('failed'):route.continue());
   await bp.getByRole('button',{name:'Save listing',exact:true}).click();await text(bp,'Could not update saved items. Please try again.');assert.equal((await db.doc(`users/${buyer}`).get()).data().savedListings?.length??0,0);await bp.unroute('**/api/market');
   const savedNow=Date.now(),savedQuota=db.doc(`operationLimits/${limitId(buyer,'savedSet')}`);await savedQuota.set({minute:Math.floor(savedNow/60000),day:Math.floor(savedNow/86400000),minuteCount:0,dayCount:LIMITS.savedSet.day});
   await bp.getByRole('button',{name:'Save listing',exact:true}).click();await bp.getByRole('alert').filter({hasText:'Saved items update limit reached'}).waitFor();assert.equal((await db.doc(`users/${buyer}`).get()).data().savedListings?.length??0,0);await shot(bp,`${name}-saved-limit`);await savedQuota.delete();
   await bp.getByRole('button',{name:'Save listing',exact:true}).click();await bp.getByRole('button',{name:'Remove from saved',exact:true}).waitFor();assert.deepEqual((await db.doc(`users/${buyer}`).get()).data().savedListings,[listingId]);assert.equal((await savedQuota.get()).data().dayCount,1);pass(name,'interrupted saved request, real quota rejection and single retry');await navigate(bp,'Saved');await text(bp,title);await fit(bp,'saved');pass(name,'search and saved items');
   await bp.locator(`a[href="/listing/${listingId}"]`).first().click();await bp.getByRole('button',{name:/Message Seller/i}).click();await bp.waitForURL('**/messages/**');await text(bp,'No messages yet. Say hello!');
   const conversationId=new URL(bp.url()).pathname.split('/').at(-1),longMessage='phone-'+ 'x'.repeat(600);
   await bp.getByPlaceholder('Type a message…').fill(longMessage);await bp.getByRole('button',{name:'Send',exact:true}).click();await text(bp,longMessage);await bp.setViewportSize({width:320,height:360});await fit(bp,'short-screen long chat');
   await bp.getByPlaceholder('Type a message…').fill('Draft after keyboard resize');await bp.getByPlaceholder('Type a message…').scrollIntoViewIfNeeded();const send=await bp.getByRole('button',{name:'Send',exact:true}).boundingBox();assert(send&&send.x>=0&&send.x+send.width<=320);await shot(bp,`${name}-chat-small`);await bp.setViewportSize(devices[device].viewport);pass(name,'long-message wrapping and reduced-height composer');
   const now=Date.now(),q=db.doc(`operationLimits/${limitId(buyer,'message')}`);await q.set({minute:Math.floor(now/60000),day:Math.floor(now/86400000),minuteCount:0,dayCount:LIMITS.message.day});
   await bp.getByRole('button',{name:'Send',exact:true}).click();await bp.getByRole('alert').filter({hasText:'Messaging limit reached'}).waitFor();assert.equal(await bp.getByPlaceholder('Type a message…').inputValue(),'Draft after keyboard resize');
   await q.delete();await bp.getByRole('button',{name:'Send',exact:true}).click();await text(bp,'Draft after keyboard resize');assert.equal((await db.collection(`conversations/${conversationId}/messages`).get()).size,2);pass(name,'real message quota and retained-draft retry');
   await navigate(sp,'My listings');await text(sp,title);await sp.getByRole('button',{name:'Mark as Reserved',exact:true}).click();await text(sp,'No active listings');await sp.getByRole('button',{name:'Reserved',exact:true}).click();await text(sp,title);
   await sp.getByRole('button',{name:'Mark as Sold',exact:true}).click();const dialog=sp.getByRole('dialog');await text(sp,'1 buyer loaded');await dialog.getByRole('radio',{name:/phone-buyer/}).check();await fit(sp,'buyer dialog');assert(await dialog.locator('.relative').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'buyer dialog content overflow');await shot(sp,`${name}-sale`);await dialog.getByRole('button',{name:'Confirm',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal((await db.doc(`transactions/${listingId}`).get()).data().buyerUid,buyer);pass(name,'reservation and confirmed buyer sale');
   await navigate(bp,'Purchases');await text(bp,title);await fit(bp,'purchases');await bp.getByRole('link',{name:'Leave a Review',exact:true}).click();await bp.getByRole('button',{name:'5 stars',exact:true}).click();await bp.getByPlaceholder('Add a comment (optional)').fill('Phone trade completed');await bp.getByRole('button',{name:'Submit Review',exact:true}).click();await text(bp,'Review submitted');assert.equal((await db.doc(`transactions/${listingId}`).get()).data().buyerReviewed,true);pass(name,'purchase and completed-trade review');
   await bp.getByRole('link',{name:/^Notifications,/}).click();await bp.getByRole('heading',{name:'Notifications',exact:true}).waitFor();await bp.getByRole('button',{name:/^Mark \d+ as read$/}).waitFor();
   const notificationNow=Date.now(),notificationQuota=db.doc(`operationLimits/${limitId(buyer,'notificationsRead')}`);await notificationQuota.set({minute:Math.floor(notificationNow/60000),day:Math.floor(notificationNow/86400000),minuteCount:0,dayCount:LIMITS.notificationsRead.day});
   await bp.getByRole('button',{name:/^Mark \d+ as read$/}).click();await bp.getByRole('alert').filter({hasText:'Notification update limit reached'}).waitFor();assert.equal((await db.collection('notifications').where('userId','==',buyer).where('read','==',true).get()).size,0);await bp.setViewportSize({width:320,height:360});await fit(bp,'short notification quota');await bp.setViewportSize(devices[device].viewport);await fit(bp,'notification quota');await shot(bp,`${name}-notifications-limit`);await notificationQuota.delete();
   await bp.getByRole('button',{name:/^Mark \d+ as read$/}).click();await bp.getByRole('button',{name:/^Unread:/}).first().waitFor({state:'hidden'});assert.equal((await notificationQuota.get()).data().dayCount,1);assert.equal((await db.collection('notifications').where('userId','==',buyer).where('read','==',false).get()).size,0);assert((await db.collection('notifications').where('userId','==',seller).where('read','==',false).get()).size>0);pass(name,'notification quota recovery preserves the other account');
   await navigate(bp,'Saved');await text(bp,title);await bp.locator(`a[href="/listing/${listingId}"]`).first().click();await text(bp,title);await bp.getByRole('button',{name:'Report listing',exact:true}).click();await bp.getByLabel('What happened?').fill('Synthetic mobile reporting check for the development marketplace.');await fit(bp,'report form');await bp.getByRole('button',{name:'Submit report',exact:true}).click();await bp.getByText(/Report received\./).waitFor();
   await bp.getByRole('button',{name:'Block user',exact:true}).click();await bp.getByRole('button',{name:'Unblock user',exact:true}).waitFor();await bp.getByRole('button',{name:'Unblock user',exact:true}).click();await text(bp,'Your block was removed.');pass(name,'mobile reporting and block controls');
   await navigate(bp,'Safety');await bp.getByText(/Awaiting review/).waitFor();await fit(bp,'safety');await navigate(bp,'Settings');await fit(bp,'settings');await navigate(bp,'My profile');await text(bp,'phone-buyer');await fit(bp,'profile');pass(name,'safety settings and profile navigation');
   // Test actual route-level rejection before any upstream storage call.
   const signIn=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${buyer}@emory.edu`,password,returnSecureToken:true})});const token=(await signIn.json()).idToken;assert(token);
   for(const [bucket,route,method] of [['photo','/api/photos/'+ 'a'.repeat(64),'GET'],['uploadAttempt','/api/upload','POST']]){
    const t=Date.now(),ref=db.doc(`operationLimits/${limitId(buyer,bucket)}`);await ref.set({minute:Math.floor(t/60000),day:Math.floor(t/86400000),minuteCount:0,dayCount:LIMITS[bucket].day});
    const result=await fetch(base+route,{method,headers:{authorization:`Bearer ${token}`}});assert.equal(result.status,429);assert(Number(result.headers.get('retry-after'))>0);assert.equal(result.headers.get('cache-control'),'private, no-store');await ref.delete();
   }pass(name,'photo and upload HTTP quota headers');
   // Browser-only image fixture checks retry UI without using external storage.
   const photoId='b'.repeat(64);await db.doc(`listings/${listingId}`).update({images:[`/api/photos/${photoId}`]});let imageRequests=0,throttled=false;
   await bp.route(`**/api/photos/${photoId}`,async route=>{imageRequests++;const reject=!throttled&&new URL(bp.url()).pathname===`/listing/${listingId}`;if(reject)throttled=true;await route.fulfill(reject?{status:429,headers:{'retry-after':'1'},contentType:'application/json',body:'{"error":"limit"}'}:{status:200,contentType:'image/jpeg',body:jpeg});});
   await navigate(bp,'Saved');await text(bp,title);await bp.locator(`a[href="/listing/${listingId}"]`).first().click();await bp.getByText('Photo viewing limit reached. Please wait before retrying.').waitFor();const beforeRetry=imageRequests;await bp.getByRole('button',{name:'Retry photo',exact:true}).click();await bp.getByText('Photo viewing limit reached. Please wait before retrying.').waitFor({state:'detached'});await bp.locator('img[src^="blob:"]').first().waitFor();assert.equal(imageRequests,beforeRetry+1);await fit(bp,'photo recovery');await shot(bp,`${name}-listing`);pass(name,'photo retry without automatic request loop');
   await bp.getByRole('button',{name:'Open menu',exact:true}).click();await bp.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Log out',exact:true}).click();await bp.waitForURL(url=>['/','/login'].includes(url.pathname));await Promise.all([bp.waitForURL('**/marketplace'),bp.getByRole('link',{name:'Marketplace',exact:true}).last().click()]);await bp.waitForURL('**/login');pass(name,'mobile logout and protected-page redirect');
  }catch(error){await shot(sp,`${name}-seller-failure`);await shot(bp,`${name}-buyer-failure`);console.log(JSON.stringify({browser:name,pageErrors:errors.length,sellerText:(await sp.locator('body').innerText()).slice(0,4000),buyerText:(await bp.locator('body').innerText()).slice(0,1000)}));throw error;}finally{for(const p of [sp,bp])p.removeAllListeners('pageerror');await browser.close();}
 }
 assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({status:'success',mobileBrowserChecks:checks,pageErrors:errors.length}));
}finally{await db.terminate();await deleteApp(app);}
