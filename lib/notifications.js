import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

export async function createNotification(userId, type, title, description, linkTo) {
  await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    description,
    linkTo: linkTo ?? null,
    read: false,
    createdAt: serverTimestamp(),
  })
}
