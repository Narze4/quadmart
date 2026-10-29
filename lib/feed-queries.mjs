import { collection, documentId, getDocsFromServer, limit, onSnapshot, orderBy, query, startAfter, where } from 'firebase/firestore';
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
        if(snap.metadata.fromCache)return;received=true;clearTimeout(timer);receive(page(snap));
      },error=>{clearTimeout(timer);fail(error);});
      return()=>{clearTimeout(timer);stop();};
    }
  };
}
export const conversationFeed = (db,uid) => ({...liveFeed(query(collection(db,'conversations'),where('participants','array-contains',uid),orderBy('lastMessageAt','desc'),orderBy(documentId(),'desc'))),compare:compareConversations});
export const messageFeed = (db,id) => ({...liveFeed(query(collection(db,'conversations',id,'messages'),orderBy('createdAt','desc'),orderBy(documentId(),'desc'))),compare:compareMessages});
