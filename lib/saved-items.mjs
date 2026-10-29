import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
export const MAX_SAVED_ITEMS = 200;
export function savedItemIds(value = []) {
  if (!Array.isArray(value) || value.length > MAX_SAVED_ITEMS || value.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))) throw Error('Saved items could not be loaded. Please retry or contact support.');
  return [...new Set(value)];
}
export async function writeSavedItem(db, uid, listingId, saved) {
  savedItemIds([listingId]);
  await updateDoc(doc(db, 'users', uid), { savedListings: saved ? arrayUnion(listingId) : arrayRemove(listingId) });
}
