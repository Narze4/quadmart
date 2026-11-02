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
 await auth.createUser({uid:'paging-buyer',email:'pagination-buyer@emory.edu',password,emailVerified:true});
 const profile={uid,email,displayName:'Paging Student',campusId:'emory.edu',university:'Emory University',transactions:0,createdAt:Timestamp.now()};
 const batch=db.batch(),createdAt=Timestamp.fromMillis(1793200000000);
 batch.set(db.doc(`users/${uid}`),profile);batch.set(db.doc(`publicProfiles/${uid}`),{displayName:'Paging Student',campusId:'emory.edu',university:'Emory University',transactions:0,createdAt});
 for(let i=0;i<133;i++)batch.set(db.doc(`listings/${String(i).padStart(4,'0')}`),{campusId:'emory.edu',sellerUid:'paging-buyer',status:'active',category:'Product',condition:'Good',title:i===0?'Rare oldest bicycle':`Paging desk ${i}`,description:'Synthetic local test listing',price:i,images:[],imageIds:[],createdAt});
 for(let i=0;i<65;i++)batch.set(db.doc(`conversations/${String(i).padStart(4,'0')}`),{participants:[uid,'paging-buyer'],participantNames:['Paging Student','Paging Buyer'],campusId:'emory.edu',listingId:'0001',listingTitle:`Paging conversation ${i}`,createdAt,lastMessageAt:createdAt,lastMessage:''});
 for(let i=0;i<125;i++)batch.set(db.doc(`conversations/0000/messages/${String(i).padStart(4,'0')}`),{senderUid:'paging-buyer',text:`History ${String(i).padStart(3,'0')}`,createdAt});
 await batch.commit();
 const history=db.batch();
 history.set(db.doc('users/paging-buyer'),{uid:'paging-buyer',email:'pagination-buyer@emory.edu',displayName:'Paging Buyer',campusId:'emory.edu',createdAt});
 history.set(db.doc('publicProfiles/paging-buyer'),{uid:'paging-buyer',displayName:'Paging Buyer',campusId:'emory.edu',university:'Emory University',createdAt,transactions:65});
 history.set(db.doc('publicProfiles/foreign-profile'),{displayName:'Hidden campus student',campusId:'uga.edu',createdAt});
 for(let i=0;i<135;i++)history.set(db.doc(`notifications/notice${String(i).padStart(3,'0')}`),{userId:uid,title:`Paging notice ${i}`,read:false,createdAt,type:'message'});
 history.set(db.doc('notifications/foreign'),{userId:'paging-buyer',title:'Other account notification',read:false,createdAt});
 for(let i=0;i<65;i++){
 history.set(db.doc(`transactions/trade${String(i).padStart(3,'0')}`),{buyerUid:uid,sellerUid:i===64?'missing-seller':'paging-buyer',campusId:'emory.edu',listingTitle:`Paging purchase ${i}`,price:i,createdAt,buyerReviewed:i===63});
 history.set(db.doc(`publicProfiles/paging-buyer/reviews/review${String(i).padStart(3,'0')}`),{campusId:'emory.edu',rating:5,comment:`Paging review ${i}`,type:'seller',createdAt});
 }
 await history.commit();
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
 // Notifications: load past 100, mark a bounded batch and an older row,
 // receive a new live event, and follow its destination only after acknowledgement.
 await page.goto('http://127.0.0.1:3100/notifications');
 await page.getByText('30 notifications loaded so far',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Notifications, 99+ unread',exact:true}).first().waitFor();
 if(process.env.QUADMART_SCREENSHOT_DIRECTORY)await page.screenshot({path:path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY,'notifications.png')});
 for(const count of [60,90,120,135]){await page.getByRole('button',{name:'Load older notifications',exact:true}).click();await page.getByText(`${count} notifications loaded${count<135?' so far':''}`,{exact:true}).waitFor();}
 assert.equal(await page.getByText('Other account notification',{exact:true}).count(),0);
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.getByRole('button',{name:'Mark 30 as read',exact:true}).click();await page.getByText('105 unread in this list',{exact:true}).waitFor();await page.getByRole('button',{name:'Mark 30 as read',exact:true}).waitFor();
 assert.equal((await db.collection('notifications').where('userId','==',uid).where('read','==',true).get()).size,30);
 await page.getByRole('button',{name:'Unread: Paging notice 0',exact:true}).click();await page.getByRole('button',{name:'Read: Paging notice 0',exact:true}).waitFor();assert.equal((await db.doc('notifications/notice000').get()).data().read,true);
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 await db.doc('notifications/notice001').update({userId:'paging-buyer'});
 await page.getByRole('button',{name:'Unread: Paging notice 1',exact:true}).click();await page.getByText('Could not mark these notifications as read. Please try again.',{exact:true}).waitFor();
 assert.equal((await db.doc('notifications/notice001').get()).data().read,false);
 await db.doc('notifications/notice001').update({userId:uid});await page.getByRole('button',{name:'Unread: Paging notice 1',exact:true}).click();await page.getByRole('button',{name:'Read: Paging notice 1',exact:true}).waitFor();
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 await db.doc('notifications/live').set({userId:uid,title:'Live notification arrival',read:false,createdAt:Timestamp.now(),type:'message',linkTo:'/messages/0001'});
 await page.getByRole('button',{name:'Unread: Live notification arrival',exact:true}).click();await page.waitForURL('**/messages/0001');assert.equal((await db.doc('notifications/live').get()).data().read,true);
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 // A failed additional page retains receipts, then retries without duplication.
 await page.goto('http://127.0.0.1:3100/my-purchases');await page.getByText('24 purchases loaded so far',{exact:true}).waitFor();await page.getByText(/from Seller unavailable/).waitFor();
 await page.getByText('Review submitted',{exact:true}).waitFor();await page.getByText('Review unavailable',{exact:true}).waitFor();
 if(process.env.QUADMART_SCREENSHOT_DIRECTORY)await page.screenshot({path:path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY,'purchases.png')});
 await page.context().setOffline(true);await page.getByRole('button',{name:'Load older purchases',exact:true}).click();
 await page.getByText('Could not load these results. Please try again.',{exact:true}).waitFor();assert.equal(await page.locator('main article').count(),24);
 await page.context().setOffline(false);await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('48 purchases loaded so far',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Load older purchases',exact:true}).click();await page.getByText('65 purchases loaded',{exact:true}).waitFor();assert.equal(await page.locator('main article').count(),65);
 const receipt=page.locator('main article').filter({has:page.getByText('Paging purchase 0',{exact:true})});assert.equal(await receipt.getByRole('link',{name:'Leave a Review'}).getAttribute('href'),'/review/paging-buyer?type=seller&transactionId=trade000');
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 // Listings and reviews paginate separately and retain their place across tabs.
 await page.goto('http://127.0.0.1:3100/profile/paging-buyer');await page.getByRole('heading',{name:'Paging Buyer',exact:true}).waitFor();await page.getByText('24 listings loaded so far',{exact:true}).waitFor();
 for(const count of [48,72,96,120,133]){await page.getByRole('button',{name:'Load older listings',exact:true}).click();await page.getByText(`${count} listings loaded${count<133?' so far':''}`,{exact:true}).waitFor();}
 assert.equal(await page.locator('main a[href^="/listing/"]').count(),133);
 await page.getByRole('button',{name:'Reviews',exact:true}).click();await page.getByText('24 reviews loaded so far',{exact:true}).waitFor();
 await page.context().setOffline(true);await page.getByRole('button',{name:'Load older reviews',exact:true}).click();await page.getByText('Could not load these results. Please try again.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Listings',exact:true}).click();await page.getByText('133 listings loaded',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Reviews',exact:true}).click();assert.equal(await page.locator('main article').count(),24);
 await page.context().setOffline(false);await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('48 reviews loaded so far',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Load older reviews',exact:true}).click();await page.getByText('65 reviews loaded',{exact:true}).waitFor();
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 await page.getByText('Paging review 0',{exact:true}).waitFor();assert.equal(await page.locator('main article').count(),65);
 if(process.env.QUADMART_SCREENSHOT_DIRECTORY){await page.getByRole('heading',{name:'Paging Buyer',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.QUADMART_SCREENSHOT_DIRECTORY,'profile-reviews.png')});}
 await page.getByRole('button',{name:'Listings',exact:true}).click();await page.getByText('133 listings loaded',{exact:true}).waitFor();
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 // Unavailable, foreign-campus and empty profiles never leave a stuck spinner.
 await page.goto('http://127.0.0.1:3100/profile/foreign-profile');await page.getByText('Profile unavailable',{exact:true}).waitFor();assert.equal(await page.getByText('Hidden campus student',{exact:true}).count(),0);
 await db.doc('publicProfiles/foreign-profile').update({campusId:'emory.edu',displayName:'Recovered local profile'});
 await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('heading',{name:'Recovered local profile'}).waitFor();await page.getByText('No listings yet',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Reviews',exact:true}).click();await page.getByText('No reviews yet',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:3100/profile/nonexistent');await page.getByText('Profile unavailable',{exact:true}).waitFor();
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 // A receipt opens its real review action and updates both receipt and profile.
 await page.goto('http://127.0.0.1:3100/my-purchases');await page.getByText('24 purchases loaded so far',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Load older purchases',exact:true}).click();await page.getByText('48 purchases loaded so far',{exact:true}).waitFor();await page.getByRole('button',{name:'Load older purchases',exact:true}).click();await page.getByText('65 purchases loaded',{exact:true}).waitFor();
 await page.locator('main article').filter({has:page.getByText('Paging purchase 0',{exact:true})}).getByRole('link',{name:'Leave a Review'}).click();
 await page.getByRole('button',{name:'5 stars',exact:true}).click();await page.getByPlaceholder('Add a comment (optional)').fill('Receipt to profile review check');await page.getByRole('button',{name:'Submit Review',exact:true}).click();await page.getByText('Review submitted',{exact:true}).waitFor();
 assert.equal((await db.doc('transactions/trade000').get()).data().buyerReviewed,true);
 await page.goto('http://127.0.0.1:3100/profile/paging-buyer');await page.getByRole('button',{name:'Reviews',exact:true}).click();await page.getByText('Receipt to profile review check',{exact:true}).waitFor();
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 // A second signed-in student sees only their own private history.
 const buyerContext=await browser.newContext(),buyerPage=await buyerContext.newPage();buyerPage.on('pageerror',e=>errors.push(e.message));
 try {
 await buyerPage.goto('http://127.0.0.1:3100/login');await buyerPage.locator('input[type=email]').fill('pagination-buyer@emory.edu');await buyerPage.locator('input[type=password]').fill(password);await buyerPage.getByRole('button',{name:/log in/i}).click();await buyerPage.waitForURL('**/dashboard');
 await buyerPage.goto('http://127.0.0.1:3100/notifications');await buyerPage.getByText('Other account notification',{exact:true}).waitFor();await buyerPage.getByText('1 notification loaded',{exact:true}).waitFor();assert.equal(await buyerPage.getByText('Paging notice 0',{exact:true}).count(),0);
 await buyerPage.getByRole('button',{name:'Mark 1 as read',exact:true}).click();await buyerPage.getByRole('link',{name:'Notifications, 0 unread',exact:true}).first().waitFor();
 await buyerPage.goto('http://127.0.0.1:3100/my-purchases');await buyerPage.getByText('No completed purchases',{exact:true}).waitFor();assert.equal(await buyerPage.getByText('Paging purchase 0',{exact:true}).count(),0);
 } finally {await buyerContext.close();}
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 // Replace the identity in the original browser too; no retained private rows.
 await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:'Log out',exact:true}).click();await page.waitForURL(url=>['/','/login'].includes(url.pathname));
 await page.goto('http://127.0.0.1:3100/login');await page.locator('input[type=email]').fill('pagination-buyer@emory.edu');await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:/log in/i}).click();await page.waitForURL('**/dashboard');
 await page.goto('http://127.0.0.1:3100/notifications');await page.getByText('1 notification loaded',{exact:true}).waitFor();assert.equal(await page.getByText('Paging notice 0',{exact:true}).count(),0);
 await page.goto('http://127.0.0.1:3100/my-purchases');await page.getByText('No completed purchases',{exact:true}).waitFor();assert.equal(await page.locator('main article').count(),0);
 passed++;console.log(JSON.stringify({browserCheck:passed}));
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({status:'success',browserChecks:passed,pageErrors:errors.length}));
}finally{await browser.close();await db.terminate();await deleteApp(app);}
