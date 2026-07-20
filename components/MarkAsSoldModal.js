'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { createNotification } from '@/lib/notifications'

const OFF_PLATFORM = 'off-platform'

export default function MarkAsSoldModal({ listing, sellerUsername, onClose, onSold }) {
  const [buyers, setBuyers] = useState([])
  const [loadingBuyers, setLoadingBuyers] = useState(true)
  const [selected, setSelected] = useState(OFF_PLATFORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadBuyers = async () => {
      try {
        const convoSnap = await getDocs(
          query(collection(db, 'conversations'), where('listingId', '==', listing.id))
        )
        const seen = new Set()
        const candidates = []
        for (const convoDoc of convoSnap.docs) {
          const convo = convoDoc.data()
          const otherEmail = convo.participants?.find(p => p !== listing.sellerEmail)
          if (!otherEmail || seen.has(otherEmail)) continue
          seen.add(otherEmail)
          const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', otherEmail)))
          if (userSnap.empty) continue
          candidates.push({ uid: userSnap.docs[0].id, email: otherEmail, username: otherEmail.split('@')[0] })
        }
        if (!cancelled) setBuyers(candidates)
      } finally {
        if (!cancelled) setLoadingBuyers(false)
      }
    }
    loadBuyers()
    return () => { cancelled = true }
  }, [listing.id, listing.sellerEmail])

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    try {
      const buyer = selected === OFF_PLATFORM ? null : buyers.find(b => b.uid === selected)
      const buyerUid = buyer?.uid ?? null

      await addDoc(collection(db, 'transactions'), {
        listingId: listing.id,
        listingTitle: listing.title,
        price: listing.price,
        sellerUid: listing.sellerUid,
        buyerUid,
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'listings', listing.id), { status: 'sold' })
      await updateDoc(doc(db, 'users', listing.sellerUid), { transactions: increment(1) })

      if (buyerUid) {
        await updateDoc(doc(db, 'users', buyerUid), { transactions: increment(1) })
        await createNotification(
          buyerUid,
          'review',
          `Did you buy ${listing.title}?`,
          `Leave ${sellerUsername} a review`,
          `/review/${listing.sellerUid}?type=seller`
        )
      }

      onSold()
    } catch {
      setError('Something went wrong marking this as sold. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-surface rounded-2xl p-6 shadow-lg animate-fade-in">
        <h2 className="text-lg font-bold text-text-primary mb-1">Who bought this?</h2>
        <p className="text-sm text-text-secondary mb-4">{listing.title}</p>

        {loadingBuyers ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-5 max-h-64 overflow-y-auto">
            {buyers.map(buyer => (
              <label
                key={buyer.uid}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                  selected === buyer.uid ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="buyer"
                  value={buyer.uid}
                  checked={selected === buyer.uid}
                  onChange={() => setSelected(buyer.uid)}
                  className="accent-green-600"
                />
                <div className="w-7 h-7 rounded-full bg-primary-dark flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {buyer.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-text-primary truncate">{buyer.username}</span>
              </label>
            ))}

            <label
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                selected === OFF_PLATFORM ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="buyer"
                value={OFF_PLATFORM}
                checked={selected === OFF_PLATFORM}
                onChange={() => setSelected(OFF_PLATFORM)}
                className="accent-green-600"
              />
              <span className="text-sm font-medium text-text-primary">Someone else / off-platform</span>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 border border-border text-text-primary text-sm font-semibold rounded-xl hover:bg-bg transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || loadingBuyers}
            className="flex-1 px-4 py-2.5 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {submitting ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
