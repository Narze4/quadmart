'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { purchaseFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import FeedStatus from '@/components/FeedStatus'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

function purchaseDate(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MyPurchasesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])
  if (loading || !user?.emailVerified) return <p role="status" className="p-8">Loading purchases…</p>
  return <Purchases key={`${user.uid}:${user.email}`} user={user} />
}

function Purchases({ user }) {
  const [retryKey, setRetryKey] = useState(0)
  const configuration = useMemo(() => ({ ...purchaseFeed(db, user.uid), retryKey }), [user.uid, retryKey])
  const feed = useCursorFeed(configuration)
  return <div className="min-h-screen flex flex-col bg-bg">
    <AuthenticatedHeader />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">
      <div className="flex items-center justify-between gap-3 mb-2"><h1 className="text-2xl font-bold text-text-primary">My Purchases</h1><Button variant="ghost" size="sm" disabled={feed.loading || feed.loadingMore} onClick={() => setRetryKey(k => k + 1)}>Refresh purchases</Button></div>
      <p className="text-sm text-text-secondary mb-6">Completed trades appear here after the seller confirms the sale. Arrange pickup in <Link href="/messages" className="text-primary-dark underline">Messages</Link>.</p>
      {!feed.loading && !feed.error && !feed.items.length && <EmptyState title="No completed purchases" description="Items you buy will show up here." action={<Button href="/marketplace">Browse Marketplace</Button>} />}
      <div className="flex flex-col gap-3">
        {feed.items.map(tx => <article key={tx.id} className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="min-w-0">
            <h2 className="font-medium text-text-primary truncate">{tx.listingTitle}</h2>
            <p className="text-sm font-bold text-primary-dark">${Number(tx.price).toFixed(2)}</p>
            <p className="text-xs text-text-secondary mt-0.5">{purchaseDate(tx.createdAt)} · from {tx.sellerName}</p>
          </div>
          {tx.buyerReviewed ? <span className="text-sm text-text-secondary">Review submitted</span> : tx.sellerAvailable ?
            <Button href={`/review/${tx.sellerUid}?type=seller&transactionId=${tx.id}`} size="sm" className="shrink-0">Leave a Review</Button> : <span className="text-sm text-text-secondary">Review unavailable</span>}
        </article>)}
      </div>
      <FeedStatus feed={feed} noun="purchases" moreLabel="Load older purchases" onRestart={() => setRetryKey(k => k + 1)} />
    </main>
    <Footer />
  </div>
}
