import { doc, writeBatch } from 'firebase/firestore';
export const NOTIFICATION_WRITE_LIMIT = 30;
export async function markNotificationsRead(db, notifications) {
  const unread = [...new Map(notifications.filter(item => !item.read).map(item => [item.id, item])).values()];
  if (unread.length > NOTIFICATION_WRITE_LIMIT) throw Error('Select at most 30 notifications');
  if (!unread.length) return [];
  const batch = writeBatch(db);
  for (const item of unread) batch.update(doc(db, 'notifications', item.id), { read: true });
  await batch.commit();
  return unread.map(item => item.id);
}
