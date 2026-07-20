import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

// Real listings (created via /sell) always carry the poster's sellerUid.
// Seed data (scripts/seed.mjs) never sets one, so a missing sellerUid with
// no matching user document for the seller's email means the listing is
// sample data, not a real seller. Cache by email since many listings share
// the same seed seller.
const cache = new Map()

export function isSampleSeller(listing) {
  if (listing?.sellerUid) return Promise.resolve(false)
  const email = listing?.sellerEmail
  if (!email) return Promise.resolve(true)

  if (!cache.has(email)) {
    cache.set(
      email,
      getDocs(query(collection(db, 'users'), where('email', '==', email)))
        .then(snap => snap.empty)
        .catch(() => true)
    )
  }
  return cache.get(email)
}
