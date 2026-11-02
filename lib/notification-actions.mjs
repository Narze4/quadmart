export const NOTIFICATION_WRITE_LIMIT = 30;
export async function markNotificationsRead(api, notifications, uid) {
  const ids = [...new Set(notifications.filter(item => !item.read).map(item => item.id))];
  if (ids.length > NOTIFICATION_WRITE_LIMIT) throw Error('Select at most 30 notifications');
  if (!ids.length) return [];
  if (ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))) throw Error('Invalid notification');
  await api('notificationsRead', { ids }, { expectedUid: uid });
  return ids;
}
