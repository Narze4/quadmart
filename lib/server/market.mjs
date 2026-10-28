import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { assertActive, assertCanContact, safetyOperation } from './safety.mjs';
import { getUniversityFromEmail } from '../universities.js';
import { MarketError } from './market-errors.mjs';
import { prepareQuota } from './limits.mjs';
import { accountClosure } from './account-closure.mjs';
import { listingOperation } from './listings.mjs';
export { MarketError };
const fail=(message,status=400)=>{throw new MarketError(message,status)};
const id=(value)=> typeof value==='string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : fail('Invalid identifier');
const key=(...values)=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
const timestamp=()=>FieldValue.serverTimestamp();
const text=(value,max)=>typeof value==='string' && value.trim().length && value.trim().length<=max ? value.trim() : fail('Invalid text');
export async function operate(db, actor, action, data) {
  const university=getUniversityFromEmail(actor.email);
  if(!actor.email_verified || !university) fail('A verified supported university email is required',403);
  const uid=actor.uid, campusId=university.domain;
  if(['accountClose','accountCloseStep','accountCloseStatus'].includes(action)) return accountClosure(db,actor,campusId,action,data);
  await assertActive(db, db, uid);
  const privateRef=db.doc(`users/${uid}`), publicRef=db.doc(`publicProfiles/${uid}`);
  if(action==='profile') {
    const name=data.displayName===undefined ? null : text(data.displayName,80);
    return db.runTransaction(async tx=>{
      await assertActive(db, tx, uid);
      const [priv,pub]=await Promise.all([tx.get(privateRef),tx.get(publicRef)]);
      const displayName=name ?? pub.data()?.displayName ?? ((typeof actor.name==='string' ? actor.name.trim().slice(0,80) : '') || 'Student');
      if(priv.exists && priv.data().campusId!==campusId) fail('Campus membership changed; contact support',403);
      const privateChanged=!priv.exists || priv.data().displayName!==displayName;
      const publicChanged=!pub.exists || pub.data().displayName!==displayName;
      if(privateChanged || publicChanged) {
        const commitQuota=await prepareQuota(db,tx,uid,'profile');commitQuota();
        if(!priv.exists) tx.create(privateRef,{uid,email:actor.email,campusId,university:university.name,displayName,createdAt:timestamp(),transactions:0});
        else if(privateChanged) tx.update(privateRef,{displayName});
        if(!pub.exists) tx.create(publicRef,{uid,campusId,university:university.name,displayName,createdAt:timestamp(),transactions:0,sellerScore:null,buyerScore:null});
        else if(publicChanged) tx.update(publicRef,{displayName});
      }
      return {uid,campusId,displayName};
    });
  }
  const actorProfile=await privateRef.get();
  if(!actorProfile.exists || actorProfile.data().campusId!==campusId) fail('Finish account setup first',403);
  if(['listingCreate','listingState'].includes(action)) return listingOperation(db,actor,campusId,action,data);
  if(['safetyStatus','safetyOverview','blockStatus','block','report','moderationQueue','moderate'].includes(action)) return safetyOperation(db, actor, campusId, action, data);
  if(action==='conversation') {
    const listingId=id(data.listingId), ref=db.doc(`conversations/${key(listingId,uid)}`);
    return db.runTransaction(async tx=>{
      await assertActive(db, tx, uid);
      const listing=await tx.get(db.doc(`listings/${listingId}`));
      if(!listing.exists || listing.data().campusId!==campusId) fail('Listing not found',404);
      const l=listing.data();if(l.sellerUid===uid) fail('You cannot message yourself');
      await assertCanContact(db, tx, uid, l.sellerUid);
      const existing=await tx.get(ref);
      if(existing.exists) return {id:ref.id};
      if(l.status!=='active') fail('Listing is no longer available',409);
      const seller=await tx.get(db.doc(`publicProfiles/${l.sellerUid}`));
      if(!seller.exists || seller.data().campusId!==campusId) fail('Seller unavailable',409);
      const commitQuota=await prepareQuota(db,tx,uid,'conversation');commitQuota();
      tx.create(ref,{participants:[uid,l.sellerUid],participantNames:[actorProfile.data().displayName,seller.data().displayName],campusId,listingId,listingTitle:l.title,lastMessage:'',createdAt:timestamp(),lastMessageAt:timestamp()});
      return {id:ref.id};
    });
  }
  if(action==='message') {
    const conversationId=id(data.conversationId), body=text(data.text,4000), requestId=id(data.requestId);
    const conv=db.doc(`conversations/${conversationId}`), message=conv.collection('messages').doc(key(uid,requestId));
    return db.runTransaction(async tx=>{
      await assertActive(db, tx, uid);
      const [c,m]=await Promise.all([tx.get(conv),tx.get(message)]);
      if(!c.exists || !c.data().participants.includes(uid) || c.data().campusId!==campusId) fail('Conversation not found',403);
      const recipient=c.data().participants.find(p=>p!==uid);
      await assertCanContact(db, tx, uid, recipient);
      if(m.exists){if(m.data().text!==body) fail('Request ID already used',409);return {id:message.id};}
      const commitQuota=await prepareQuota(db,tx,uid,'message');commitQuota();
      tx.create(message,{text:body,senderUid:uid,createdAt:timestamp()});
      tx.update(conv,{lastMessage:body,lastMessageAt:timestamp()});
      tx.create(db.doc(`notifications/${key(conversationId,message.id)}`),{userId:recipient,type:'message',title:`New message from ${actorProfile.data().displayName}`,description:body.slice(0,50),linkTo:`/messages/${conversationId}`,read:false,createdAt:timestamp()});
      return {id:message.id};
    });
  }
  if(action==='sale') {
    const listingId=id(data.listingId), buyerUid=data.buyerUid===null ? null : id(data.buyerUid);
    const listingRef=db.doc(`listings/${listingId}`), saleRef=db.doc(`transactions/${listingId}`);
    return db.runTransaction(async tx=>{
      await assertActive(db, tx, uid);
      const [listing,sale]=await Promise.all([tx.get(listingRef),tx.get(saleRef)]);
      if(!listing.exists || listing.data().sellerUid!==uid || listing.data().campusId!==campusId) fail('Listing not found',403);
      if(buyerUid===uid) fail('You cannot buy your own listing');
      if(sale.exists){if(sale.data().buyerUid!==buyerUid) fail('Sale already completed for another buyer',409);return {id:saleRef.id};}
      if(!['active','reserved'].includes(listing.data().status)) fail('Listing is not available',409);
      if(buyerUid){
        await assertCanContact(db, tx, uid, buyerUid);
        const [buyer,conversation]=await Promise.all([tx.get(db.doc(`users/${buyerUid}`)),tx.get(db.doc(`conversations/${key(listingId,buyerUid)}`))]);
        if(!buyer.exists || buyer.data().campusId!==campusId || !conversation.exists || !conversation.data().participants.includes(uid)) fail('Buyer must have contacted you about this listing',403);
      }
      const l=listing.data();
      tx.create(saleRef,{listingId,listingTitle:l.title,price:l.price,sellerUid:uid,buyerUid,campusId,createdAt:timestamp()});
      tx.update(listingRef,{status:'sold'});
      for(const person of [uid,buyerUid].filter(Boolean)){
        tx.update(db.doc(`users/${person}`),{transactions:FieldValue.increment(1)});
        tx.update(db.doc(`publicProfiles/${person}`),{transactions:FieldValue.increment(1)});
      }
      if(buyerUid) for(const [recipient,target,type] of [[buyerUid,uid,'seller'],[uid,buyerUid,'buyer']]){
        tx.create(db.doc(`notifications/${key('sale',listingId,recipient)}`),{userId:recipient,type:'review',title:`Review your trade: ${l.title}`,description:'Share your experience',linkTo:`/review/${target}?type=${type}&transactionId=${listingId}`,read:false,createdAt:timestamp()});
      }
      return {id:saleRef.id};
    });
  }
  if(action==='review') {
    const transactionId=id(data.transactionId), rating=data.rating;
    if(!Number.isInteger(rating)||rating<1||rating>5) fail('Rating must be between 1 and 5');
    if(typeof data.comment!=='string'||data.comment.length>2000) fail('Comment is too long');
    return db.runTransaction(async tx=>{
      await assertActive(db, tx, uid);
      const sale=await tx.get(db.doc(`transactions/${transactionId}`));
      if(!sale.exists || sale.data().campusId!==campusId) fail('Transaction not found',403);
      const s=sale.data(),type=uid===s.buyerUid?'seller':uid===s.sellerUid?'buyer':null;
      const target=type==='seller'?s.sellerUid:s.buyerUid;
      if(!type || !target || target===uid) fail('Only participants can review a completed trade',403);
      const profile=db.doc(`publicProfiles/${target}`), review=profile.collection('reviews').doc(key(transactionId,uid));
      const [old,p]=await Promise.all([tx.get(review),tx.get(profile)]);
      if(old.exists){if(old.data().rating!==rating||old.data().comment!==data.comment.trim()) fail('This trade has already been reviewed',409);return {id:review.id};}
      if(!p.exists) fail('Profile unavailable',404);
      const count=(p.data()[`${type}ReviewCount`]??0)+1,sum=(p.data()[`${type}RatingSum`]??0)+rating;
      tx.create(review,{transactionId,reviewerUid:uid,targetUid:target,type,rating,comment:data.comment.trim(),campusId,createdAt:timestamp()});
      tx.update(profile,{[`${type}ReviewCount`]:count,[`${type}RatingSum`]:sum,[`${type}Score`]:Math.round(sum/count*20)});
      tx.update(sale.ref,{[type==='seller'?'buyerReviewed':'sellerReviewed']:true});
      return {id:review.id};
    });
  }
  fail('Unknown operation');
}
