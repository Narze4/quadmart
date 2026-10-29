import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Isolated emulator required');
const app=initializeApp({projectId:'demo-quadmart'},'pagination-browser'),db=getFirestore(app),auth=getAuth(app),uid='paging-ui-seller',email='pagination-seller@emory.edu',password='Local-only-password-123!';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});let passed=0;
try{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-quadmart/databases/(default)/documents',{method:'DELETE'});
 await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-quadmart/accounts',{method:'DELETE'});
 await auth.createUser({uid,email,password,emailVerified:true});
 const profile={uid,email,displayName:'Paging Student',campusId:'emory.edu',university:'Emory University',transactions:0,createdAt:Timestamp.now()};
 const batch=db.batch(),createdAt=Timestamp.fromMillis(1793200000000);
 batch.set(db.doc(`users/${uid}`),profile);batch.set(db.doc(`publicProfiles/${uid}`),{displayName:'Paging Student',campusId:'emory.edu',university:'Emory University',transactions:0,createdAt});
 for(let i=0;i<133;i++)batch.set(db.doc(`listings/${String(i).padStart(4,'0')}`),{campusId:'emory.edu',sellerUid:'paging-buyer',status:'active',category:'Product',condition:'Good',title:i===0?'Rare oldest bicycle':`Paging desk ${i}`,description:'Synthetic local test listing',price:i,images:[],imageIds:[],createdAt});
 for(let i=0;i<65;i++)batch.set(db.doc(`conversations/${String(i).padStart(4,'0')}`),{participants:[uid,'paging-buyer'],participantNames:['Paging Student','Paging Buyer'],campusId:'emory.edu',listingId:'0001',listingTitle:`Paging conversation ${i}`,createdAt,lastMessageAt:createdAt,lastMessage:''});
 for(let i=0;i<125;i++)batch.set(db.doc(`conversations/0000/messages/${String(i).padStart(4,'0')}`),{senderUid:'paging-buyer',text:`History ${String(i).padStart(3,'0')}`,createdAt});
 await batch.commit();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3100/login');await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:/log in/i}).click();await page.waitForURL('**/dashboard');
 await page.goto('http://127.0.0.1:3100/marketplace');await page.getByText('24 listings shown so far',{exact:true}).waitFor();passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.getByRole('button',{name:'Load more listings',exact:true}).click();await page.getByText('48 listings shown so far',{exact:true}).waitFor();passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.locator('select').first().selectOption('price-asc');await page.getByText('Rare oldest bicycle',{exact:true}).waitFor();assert.equal(await page.locator('a[href^="/listing/"]').first().innerText().then(s=>s.includes('Rare oldest bicycle')),true);passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.locator('select').first().selectOption('newest');await page.getByPlaceholder('Search listings…').fill('oldest bicycle');await page.getByText('No matches in this batch',{exact:true}).waitFor();await page.getByRole('button',{name:'Continue searching',exact:true}).click();await page.getByText('Rare oldest bicycle',{exact:true}).waitFor();await page.getByText('1 listing found',{exact:true}).waitFor();passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.getByRole('button',{name:'Clear all (1)',exact:true}).click();await page.getByText('24 listings shown so far',{exact:true}).waitFor();passed++;console.log(JSON.stringify({browserCheck:passed}));
 if(process.env.QUADMART_SCREENSHOT_DIRECTORY){await fs.mkdir(process.env.QUADMART_SCREENSHOT_DIRECTORY,{recursive:true});await page.screenshot({path:path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY,'marketplace.png'),fullPage:true});}
 await page.goto('http://127.0.0.1:3100/messages');await page.getByText('Re: Paging conversation 64',{exact:true}).waitFor();assert.equal(await page.locator('a[href^="/messages/"]').count(),30);await page.getByRole('button',{name:'Load older conversations',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('a[href^="/messages/"]').length===60);await page.getByRole('button',{name:'Load older conversations',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('a[href^="/messages/"]').length===65);passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.goto('http://127.0.0.1:3100/messages/0000');await page.getByText('History 124',{exact:true}).waitFor();assert.equal(await page.getByText('History 000',{exact:true}).count(),0);
 for(const text of ['History 065','History 035','History 005','History 000']){await page.getByRole('button',{name:'Load older messages',exact:true}).click();await page.getByText(text,{exact:true}).waitFor();}passed++;console.log(JSON.stringify({browserCheck:passed}));
 await db.doc('conversations/0000/messages/new').set({senderUid:'paging-buyer',text:'Live new message',createdAt:Timestamp.now()});await page.getByText('Live new message',{exact:true}).waitFor();await page.getByText('History 000',{exact:true}).waitFor();passed++;console.log(JSON.stringify({browserCheck:passed}));
 const burst=db.batch();for(let i=0;i<35;i++)burst.set(db.doc(`conversations/0000/messages/burst${String(i).padStart(3,'0')}`),{senderUid:'paging-buyer',text:`Burst ${i}`,createdAt:Timestamp.now()});await burst.commit();await page.getByText('New activity refreshed this conversation. Load older messages again to continue.',{exact:true}).waitFor();await page.getByRole('button',{name:'Load older messages',exact:true}).click();await page.getByText('Live new message',{exact:true}).waitFor();passed++;console.log(JSON.stringify({browserCheck:passed}));
 if(process.env.QUADMART_SCREENSHOT_DIRECTORY)await page.screenshot({path:path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY,'chat.png'),fullPage:true});
 await page.goto('http://127.0.0.1:3100/messages/0001');await page.getByText('No messages yet. Say hello!',{exact:true}).waitFor();assert.equal(await page.getByText('History 000',{exact:true}).count(),0);assert.equal(errors.length,0,errors.join('\n'));passed++;console.log(JSON.stringify({browserCheck:passed}));
 console.log(JSON.stringify({status:'success',browserChecks:passed,pageErrors:errors.length}));
}finally{await browser.close();await db.terminate();await deleteApp(app);}
