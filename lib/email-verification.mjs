import { sendEmailVerification } from 'firebase/auth';
import { getUniversityFromEmail } from './universities.js';

export const RESEND_COOLDOWN = 60;
const storageKey = uid => `quadmart:verification:${uid}`;
export function verificationStatus(uid) {
  try { return JSON.parse(sessionStorage.getItem(storageKey(uid))) ?? {}; }
  catch { return {}; }
}
function saveStatus(uid, value) {
  try { sessionStorage.setItem(storageKey(uid), JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ }
}
export function verificationSettings(origin) {
  const url = new URL(origin);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password) throw new Error('Invalid verification return address');
  return { url: `${url.origin}/verify-email`, handleCodeInApp: false };
}
export async function sendVerification(user, origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin) {
  if (!user || !getUniversityFromEmail(user.email)) throw new Error('Use a supported university email address.');
  const previous = verificationStatus(user.uid);
  if (Date.now() - (previous.sentAt ?? 0) < RESEND_COOLDOWN * 1000) throw new Error('Please wait a minute before requesting another email.');
  try {
    await sendEmailVerification(user, verificationSettings(origin));
    const result = { sentAt: Date.now() };
    saveStatus(user.uid, result);
    return result;
  } catch (error) {
    const message = error.code === 'auth/too-many-requests'
      ? 'Too many requests. Wait a few minutes before sending another email.'
      : 'Your account exists, but we could not send the verification email. Please retry below.';
    saveStatus(user.uid, { error: message });
    throw new Error(message);
  }
}
