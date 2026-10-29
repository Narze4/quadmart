'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '@/lib/firebase'
import { listingBuyersFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import FeedStatus from '@/components/FeedStatus'
import { marketApi } from '@/lib/market-api'

const OFF_PLATFORM = 'off-platform'

export default function MarkAsSoldModal({ listing, onClose, onSold }) {
  const [retryKey, setRetryKey] = useState(0)
  const configuration = useMemo(() => ({ ...listingBuyersFeed(db, listing.id, listing.sellerUid), retryKey }), [listing.id, listing.sellerUid, retryKey])
  const feed = useCursorFeed(configuration)
  const buyers = feed.items
  const loadingBuyers = feed.loading
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const [selected, setSelected] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (submitting || !selected || feed.error) return
    setSubmitting(true)
    setError('')
    try {
      const buyer = selected === OFF_PLATFORM ? null : buyers.find(b => b.uid === selected)
      const buyerUid = selected === OFF_PLATFORM ? null : buyer?.uid
      if (buyerUid === undefined) throw Error('Choose an available buyer')

      await marketApi('sale', { listingId: listing.id, buyerUid })

      if (active.current) onSold()
    } catch {
      if (!active.current) return
      setError('Something went wrong marking this as sold. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-surface rounded-2xl p-6 shadow-lg animate-fade-in">
        <h2 className="text-lg font-bold text-text-primary mb-1">Who bought this?</h2>
        <p className="text-sm text-text-secondary mb-4 [overflow-wrap:anywhere]">{listing.title}</p>

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
                  disabled={submitting}
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
                disabled={submitting}
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

        <FeedStatus feed={feed} noun="buyers" moreLabel="Load more buyers" onRestart={() => setRetryKey(k => k + 1)} />
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
            disabled={submitting || loadingBuyers || !selected || !!feed.error || (selected !== OFF_PLATFORM && !buyers.some(b => b.uid === selected))}
            className="flex-1 px-4 py-2.5 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {submitting ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
