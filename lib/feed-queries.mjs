import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, onSnapshot, orderBy, query, startAfter, where } from 'firebase/firestore';
export const LISTING_PAGE_SIZE = 24;
export const MESSAGE_PAGE_SIZE = 30;
const row = doc => ({ ...doc.data(), id: doc.id, cursor: doc });
const after = cursor => cursor ? [startAfter(cursor)] : [];
export function compareNewest(field) {
  return (a,b) => {
    const av=a[field], bv=b[field];
    const seconds=(bv?.seconds ?? 0)-(av?.seconds ?? 0),nanos=(bv?.nanoseconds ?? 0)-(av?.nanoseconds ?? 0);
    return seconds || nanos || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1);
  };
}
export const compareMessages = compareNewest('createdAt');
export const compareConversations = compareNewest('lastMessageAt');
export function marketplaceFeed(db, campusId, filters) {
  const clauses=[where('campusId','==',campusId),where('status','==','active')];
  if(filters.category !== 'All')clauses.push(where('category','==',filters.category));
  if(filters.condition)clauses.push(where('condition','==',filters.condition));
  const priceOrder=filters.sort==='price-asc'?'asc':filters.sort==='price-desc'?'desc':null;
  clauses.push(orderBy(priceOrder?'price':'createdAt',priceOrder??'desc'),orderBy(documentId(),priceOrder??'desc'));
  const base=query(collection(db,'listings'),...clauses);
  const search=filters.search.trim().toLowerCase(),min=filters.minPrice===''?null:Number(filters.minPrice),max=filters.maxPrice===''?null:Number(filters.maxPrice);
  return async cursor => {
    if((min!==null&&(!Number.isFinite(min)||min<0))||(max!==null&&(!Number.isFinite(max)||max<0))||(min!==null&&max!==null&&min>max))throw Error('Invalid price range');
    const items=[];let next=cursor,hasMore=true;
    // Firestore has no substring text search. Preserve title matching while
    // bounding scans at 100 document reads per click (4 x 25), with a cursor
    // even when a batch has no matches. UI must not claim the search is done.
    for(let batch=0;batch<4&&items.length<LISTING_PAGE_SIZE&&hasMore;batch++){
      const snap=await getDocsFromServer(query(base,...after(next),limit(LISTING_PAGE_SIZE+1)));
      const docs=snap.docs.slice(0,LISTING_PAGE_SIZE);hasMore=snap.size>LISTING_PAGE_SIZE;
      for(let i=0;i<docs.length;i++){
        const doc=docs[i],data=doc.data();next=doc;
        if((!search||data.title?.toLowerCase().includes(search))&&(min===null||data.price>=min)&&(max===null||data.price<=max))items.push(row(doc));
        if(items.length===LISTING_PAGE_SIZE){hasMore=hasMore||i<docs.length-1;break;}
      }
      if(!docs.length)hasMore=false;
    }
    return {items,cursor:next,hasMore};
  };
}
function liveFeed(base) {
  const page = snap => ({items:snap.docs.slice(0,MESSAGE_PAGE_SIZE).map(row),cursor:snap.docs[Math.min(snap.size,MESSAGE_PAGE_SIZE)-1]??null,hasMore:snap.size>MESSAGE_PAGE_SIZE});
  return {
    pageSize:MESSAGE_PAGE_SIZE,
    loadPage:async cursor=>page(await getDocsFromServer(query(base,...after(cursor),limit(MESSAGE_PAGE_SIZE+1)))),
    watch:(receive,fail)=>{
      let received=false;
      const timer=setTimeout(()=>{if(!received)fail({code:'unavailable'});},15000);
      const stop=onSnapshot(query(base,limit(MESSAGE_PAGE_SIZE+1)),{includeMetadataChanges:true},snap=>{
        if(snap.metadata.fromCache || snap.metadata.hasPendingWrites)return;received=true;clearTimeout(timer);receive(page(snap));
      },error=>{clearTimeout(timer);fail(error);});
      return()=>{clearTimeout(timer);stop();};
    }
  };
}
export const conversationFeed = (db,uid) => ({...liveFeed(query(collection(db,'conversations'),where('participants','array-contains',uid),orderBy('lastMessageAt','desc'),orderBy(documentId(),'desc'))),compare:compareConversations});
export const messageFeed = (db,id) => ({...liveFeed(query(collection(db,'conversations',id,'messages'),orderBy('createdAt','desc'),orderBy(documentId(),'desc'))),compare:compareMessages});

// Non-live collections fetch one bounded page, including a lookahead record.
function pagedFeed(base, pageSize = LISTING_PAGE_SIZE) {
  return { pageSize, loadPage: async cursor => {
    const snap = await getDocsFromServer(query(base, ...after(cursor), limit(pageSize + 1)));
    const docs = snap.docs.slice(0, pageSize);
    return { items: docs.map(row), cursor: docs.at(-1) ?? null, hasMore: snap.size > pageSize };
  } };
}
const newest = () => [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];
export const notificationFeed = (db, uid) => ({
  ...liveFeed(query(collection(db, 'notifications'), where('userId', '==', uid), ...newest())), compare: compareMessages,
});
export const unreadNotificationsQuery = (db, uid) => query(
  collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', false), limit(100),
);
export function purchaseFeed(db, uid) {
  const feed = pagedFeed(query(collection(db, 'transactions'), where('buyerUid', '==', uid), ...newest()));
  return { ...feed, loadPage: async cursor => {
    const page = await feed.loadPage(cursor);
    // Optional display names cannot make a valid receipt disappear. Fetch only
    // sellers in this page; deleted/inaccessible profiles have an explicit fallback.
    const names = new Map(), available = new Set();
    await Promise.all([...new Set(page.items.map(tx => tx.sellerUid).filter(Boolean))].map(async sellerUid => {
      try {
        const profile = await getDocFromServer(doc(db, 'publicProfiles', sellerUid));
        if (profile.exists()) available.add(sellerUid);
        names.set(sellerUid, profile.data()?.displayName || 'Seller unavailable');
      } catch { names.set(sellerUid, 'Seller unavailable'); }
    }));
    return { ...page, items: page.items.map(tx => ({ ...tx, sellerName: names.get(tx.sellerUid) ?? 'Seller unavailable', sellerAvailable: available.has(tx.sellerUid) })) };
  } };
}
export const profileListingsFeed = (db, uid, campusId) => pagedFeed(query(
  collection(db, 'listings'), where('sellerUid', '==', uid), where('campusId', '==', campusId), ...newest(),
));
export const profileReviewsFeed = (db, uid, campusId) => pagedFeed(query(
  collection(db, 'publicProfiles', uid, 'reviews'), where('campusId', '==', campusId), ...newest(),
));
export const publicProfileFeed = (db, uid) => ({ loadPage: async () => {
  const snap = await getDocFromServer(doc(db, 'publicProfiles', uid));
  return { items: snap.exists() ? [row(snap)] : [], cursor: null, hasMore: false };
} });

export const recentListingsFeed = (db, campusId) => pagedFeed(query(
  collection(db, 'listings'), where('campusId', '==', campusId), where('status', '==', 'active'), ...newest(),
), 8);
export const sellerListingsFeed = (db, uid, campusId, status) => {
  if (!['active', 'reserved', 'sold'].includes(status)) throw Error('Invalid listing status');
  return pagedFeed(query(collection(db, 'listings'), where('sellerUid', '==', uid), where('campusId', '==', campusId), where('status', '==', status), ...newest()));
};
export function savedListingsFeed(db, uid, campusId, savedIds) {
  // Freeze membership for offset cursors. A changed bookmark list creates a new
  // feed; deleted/foreign documents stay explicit unavailable slots, not errors.
  const ids = [...new Set(savedIds)].reverse();
  return { loadPage: async (cursor = 0) => {
    const offset = cursor ?? 0, batch = ids.slice(offset, offset + LISTING_PAGE_SIZE);
    if (!batch.length) return { items: [], cursor: offset, hasMore: false };
    const items = await Promise.all(batch.map(async id => {
      try {
        const snap = await getDocFromServer(doc(db, 'listings', id));
        return snap.exists() && snap.data().campusId === campusId ? row(snap) : { id, unavailable: true };
      } catch (error) {
        if (['permission-denied', 'not-found'].includes(error.code)) return { id, unavailable: true };
        throw error;
      }
    }));
    // Distinguish unavailable bookmarks from revoked account access. This
    // server check runs after the individual reads so denial clears the page.
    const account = await getDocFromServer(doc(db, 'users', uid));
    if (!account.exists()) throw Error('Account unavailable');
    const next = offset + batch.length;
    return { items, cursor: next, hasMore: next < ids.length };
  } };
}
export function listingBuyersFeed(db, listingId, sellerUid) {
  const feed = pagedFeed(query(collection(db, 'conversations'), where('listingId', '==', listingId), where('participants', 'array-contains', sellerUid), orderBy(documentId(), 'asc')));
  return { ...feed, loadPage: async cursor => {
    const page = await feed.loadPage(cursor);
    const candidates = await Promise.all(page.items.map(async conversation => {
      const uid = conversation.participants?.find(id => id !== sellerUid);
      if (!uid) return null;
      try {
        const profile = await getDocFromServer(doc(db, 'publicProfiles', uid));
        return profile.exists() ? { id: uid, uid, username: profile.data().displayName || 'Student' } : null;
      } catch (error) {
        if (['permission-denied', 'not-found'].includes(error.code)) return null;
        throw error;
      }
    }));
    return { ...page, items: candidates.filter(Boolean) };
  } };
}
