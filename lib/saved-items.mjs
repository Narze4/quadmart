export const MAX_SAVED_ITEMS = 200;
export function savedItemIds(value = []) {
  if (!Array.isArray(value) || value.length > MAX_SAVED_ITEMS || value.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))) throw Error('Saved items could not be loaded. Please retry or contact support.');
  return [...new Set(value)];
}
export async function writeSavedItem(api, uid, listingId, saved) {
  savedItemIds([listingId]);
  if (typeof saved !== 'boolean') throw Error('Invalid saved item');
  await api('savedSet', { listingId, saved }, { expectedUid: uid });
}
