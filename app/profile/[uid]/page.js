'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { publicProfileFeed, profileListingsFeed, profileReviewsFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import FeedStatus from '@/components/FeedStatus'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import SafetyActions from '@/components/SafetyActions'
import Footer from '@/components/Footer'
import ListingCard from '@/components/ListingCard'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

function memberSince(ts) {
  if (!ts) return 'Unknown'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { uid } = useParams()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  if (loading || !user || !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <ProfileLoader key={`${user.uid}:${user.email}:${uid}`} user={user} uid={uid} />
}

function ProfileLoader({ user, uid }) {
  const [retryKey, setRetryKey] = useState(0)
  const configuration = useMemo(() => ({ ...publicProfileFeed(db, uid), retryKey }), [uid, retryKey])
  const feed = useCursorFeed(configuration)
  const profile = feed.items[0]
  if (!profile) return <div className="min-h-screen flex flex-col bg-bg">
    <AuthenticatedHeader />
    <main className="flex-1 max-w-2xl mx-auto p-8 w-full">
      {feed.loading ? <p role="status">Loading profile…</p> : <EmptyState title="Profile unavailable" description="This profile may no longer exist or may not be available to your account." action={<Button onClick={() => setRetryKey(k => k + 1)}>Try again</Button>} />}
      {!feed.loading && <Link className="block text-center text-primary-dark underline mt-4" href="/marketplace">Back to marketplace</Link>}
    </main><Footer />
  </div>
  return <ProfileContent user={user} uid={uid} profile={profile} />
}

function ProfileContent({ user, uid, profile }) {
  const [activeTab, setActiveTab] = useState('Listings')
  const [listingRetry, setListingRetry] = useState(0)
  const [reviewRetry, setReviewRetry] = useState(0)
  const listingConfiguration = useMemo(() => ({ ...profileListingsFeed(db, uid, profile.campusId), retryKey: listingRetry }), [uid, profile.campusId, listingRetry])
  const reviewConfiguration = useMemo(() => ({ ...profileReviewsFeed(db, uid, profile.campusId), retryKey: reviewRetry }), [uid, profile.campusId, reviewRetry])
  const listings = useCursorFeed(listingConfiguration)
  const reviews = useCursorFeed(reviewConfiguration)

  const username = profile.displayName || 'Student'
  const initial = username[0]?.toUpperCase()
  const isOwnProfile = user.uid === uid

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">

        {/* Profile header */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary-dark flex items-center justify-center text-white text-3xl font-bold shrink-0">
              {initial}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-text-primary">{username}</h1>
              {profile.university && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 text-text-secondary">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
                  </svg>
                  <span className="text-sm">{profile.university}</span>
                </div>
              )}
              <p className="text-xs text-text-secondary mt-1">Member since {memberSince(profile.createdAt)}</p>

              {isOwnProfile && (
                <Link
                  href="/settings"
                  className="inline-block mt-3 px-4 py-1.5 text-sm font-medium border border-border text-text-secondary rounded-xl hover:bg-bg transition-all duration-200 active:scale-95"
                >
                  Edit Profile
                </Link>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 sm:gap-8 shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-dark">{profile.sellerScore ?? 'New'}</p>
                <p className="text-xs text-text-secondary mt-0.5">Seller Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{profile.buyerScore ?? 'New'}</p>
                <p className="text-xs text-text-secondary mt-0.5">Buyer Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary">{profile.transactions ?? 0}</p>
                <p className="text-xs text-text-secondary mt-0.5">Transactions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6"><SafetyActions targetUid={uid} /></div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {['Listings', 'Reviews'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Listings' && <section aria-label="Profile listings">
          {!listings.loading && !listings.error && !listings.items.length && <EmptyState title="No listings yet" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.items.map(listing => <ListingCard key={listing.id} listing={listing} showSeller={false} />)}
          </div>
          <FeedStatus feed={listings} noun="listings" moreLabel="Load older listings" onRestart={() => setListingRetry(k => k + 1)} />
        </section>}
        {activeTab === 'Reviews' && <section aria-label="Profile reviews">
          {!reviews.loading && !reviews.error && !reviews.items.length && <EmptyState title="No reviews yet" />}
          <div className="space-y-4">{reviews.items.map(review => <article key={review.id} className="p-4 bg-surface rounded-xl border border-border">
            <p>{review.rating}/5 · {review.type === 'seller' ? 'As a seller' : 'As a buyer'}</p><p>{review.comment}</p>
          </article>)}</div>
          <FeedStatus feed={reviews} noun="reviews" moreLabel="Load older reviews" onRestart={() => setReviewRetry(k => k + 1)} />
        </section>}
      </main>
      <Footer />
    </div>
  )
}
