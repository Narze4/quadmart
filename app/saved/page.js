'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { savedListingsFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import { getCampusId } from '@/lib/utils'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import ListingCard from '@/components/ListingCard'
import SaveListingButton from '@/components/SaveListingButton'
import FeedStatus from '@/components/FeedStatus'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

export default function SavedPage() {
  const { user, loading, savedListings, savedLoading, savedError, retrySaved } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])
  if (loading || !user?.emailVerified) return <p role="status" className="p-8">Loading saved items…</p>
  return <div className="min-h-screen flex flex-col bg-bg"><AuthenticatedHeader />
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Saved</h1>
      {savedLoading ? <p role="status">Loading saved items…</p> : savedError ? <div role="alert"><p>{savedError}</p><Button className="mt-3" onClick={retrySaved}>Try again</Button></div> :
        <SavedItems key={`${user.uid}:${user.email}:${JSON.stringify(savedListings)}`} uid={user.uid} campusId={getCampusId(user.email)} ids={savedListings} />}
    </main><Footer />
  </div>
}

function SavedItems({ uid, campusId, ids }) {
  const [retryKey, setRetryKey] = useState(0)
  const configuration = useMemo(() => ({ ...savedListingsFeed(db, uid, campusId, ids), retryKey }), [uid, campusId, ids, retryKey])
  const feed = useCursorFeed(configuration)
  return <>
    {!feed.loading && !feed.error && !feed.items.length && <EmptyState title="No saved items yet" description="Tap the heart on a listing to save it here." action={<Button href="/marketplace">Browse Marketplace</Button>} />}
    {feed.items.some(item => item.unavailable) && <p className="mb-4 text-sm text-text-secondary">Some saved listings were removed or are no longer available on your campus. You can remove them from this list.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{feed.items.map(item => item.unavailable ?
      <article key={item.id} className="bg-surface rounded-2xl border border-border p-6 space-y-4"><h2 className="font-semibold">Listing unavailable</h2><SaveListingButton listingId={item.id} removeOnly /></article> :
      <ListingCard key={item.id} listing={item} />)}</div>
    <FeedStatus feed={feed} noun="saved items" moreLabel="Load more saved items" onRestart={() => setRetryKey(k => k + 1)} />
  </>
}
