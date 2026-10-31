'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedPhoto from '@/components/ProtectedPhoto'
import { useAuth } from '@/lib/auth-context'
import { marketApi } from '@/lib/market-api'
import { db } from '@/lib/firebase'
import { sellerListingsFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import FeedStatus from '@/components/FeedStatus'
import { getListingStatus, getUsername, getCampusId } from '@/lib/utils'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import CategoryPlaceholder from '@/components/CategoryPlaceholder'
import MarkAsSoldModal from '@/components/MarkAsSoldModal'

const TABS = ['Active', 'Reserved', 'Sold']

const CONDITION_TONE = {
  New: 'green',
  'Like New': 'blue',
  Good: 'yellow',
  Fair: 'orange',
}

const STATUS_TONE = {
  active: 'green',
  reserved: 'yellow',
  sold: 'neutral',
}

const BoxIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

export default function MyListingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
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

  return <SellerListings key={`${user.uid}:${user.email}`} user={user} />
}

function SellerListings({ user }) {
  const [activeTab, setActiveTab] = useState('Active')
  const [updatingId, setUpdatingId] = useState(null)
  const pendingState = useRef(new Map())
  const [actionError, setActionError] = useState('')
  const [soldModalListing, setSoldModalListing] = useState(null)

  const [retryKey, setRetryKey] = useState(0)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const configuration = useMemo(() => ({ ...sellerListingsFeed(db, user.uid, getCampusId(user.email), activeTab.toLowerCase()), retryKey }), [user.uid, user.email, activeTab, retryKey])
  const feed = useCursorFeed(configuration)
  const currentListings = feed.items.filter(listing => getListingStatus(listing) === activeTab.toLowerCase())
  const fetchLoading = feed.loading
  const handleRetry = () => setRetryKey(k => k + 1)
  const sellerUsername = getUsername(user)
  const setLocalStatus = (id, status, version) => {
    feed.updateItems(new Map([[id, { status, ...(version === undefined ? {} : { version }) }]]))
  }

  const handleSetStatus = async (listing, status) => {
    if (updatingId) return
    setUpdatingId(listing.id)
    setActionError('')
    const data = { listingId: listing.id, status, expectedVersion: listing.version ?? 0 }
    const signature = JSON.stringify(data)
    if (!pendingState.current.has(signature)) pendingState.current.set(signature, crypto.randomUUID())
    try {
      const result = await marketApi('listingState', { ...data, requestId: pendingState.current.get(signature) })
      if (!active.current) return
      setLocalStatus(listing.id, result.status, result.version)
      pendingState.current.delete(signature)
    } catch (error) {
      if (!active.current) return
      setActionError(error.message)
      if (error.status === 409) setRetryKey(k => k + 1)
    } finally {
      if (active.current) setUpdatingId(null)
    }
  }

  const handleSold = () => {
    if (!active.current) return
    setLocalStatus(soldModalListing.id, 'sold')
    setSoldModalListing(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <h1 className="text-2xl font-bold text-text-primary">My Listings</h1>
          </div>
          <Link
            href="/sell"
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Listing
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setActionError(''); setActiveTab(tab) }}
              disabled={!!updatingId}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {actionError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}

        {/* Content */}
        {fetchLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-4 shadow-sm">
                <Skeleton className="w-16 h-16 shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : currentListings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {currentListings.map(listing => {
              const status = getListingStatus(listing)
              return (
                <div key={listing.id} className="bg-surface rounded-2xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:shadow-md transition-all duration-200">
                  <Link href={`/listing/${listing.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                      {listing.images?.[0] ? (
                        <ProtectedPhoto src={listing.images[0]} alt={listing.title} className="object-cover" />
                      ) : (
                        <CategoryPlaceholder category={listing.category} size="sm" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text-primary truncate">{listing.title}</h3>
                      <p className="text-sm font-bold text-primary-dark">${Number(listing.price).toFixed(2)}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {listing.condition && (
                          <Badge tone={CONDITION_TONE[listing.condition] ?? 'neutral'}>{listing.condition}</Badge>
                        )}
                        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                      </div>
                    </div>
                  </Link>

                  {status !== 'sold' && (
                    <div className="flex gap-2 shrink-0">
                      {status === 'active' && (
                        <button
                          onClick={() => handleSetStatus(listing, 'reserved')}
                          disabled={!!updatingId}
                          className="px-3 py-2 border border-border text-text-primary text-xs font-semibold rounded-xl hover:bg-bg transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                          Mark as Reserved
                        </button>
                      )}
                      {status === 'reserved' && (
                        <button
                          onClick={() => handleSetStatus(listing, 'active')}
                          disabled={!!updatingId}
                          className="px-3 py-2 border border-border text-text-primary text-xs font-semibold rounded-xl hover:bg-bg transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                          Back to Active
                        </button>
                      )}
                      <button
                        onClick={() => setSoldModalListing(listing)}
                        disabled={!!updatingId}
                        className="px-3 py-2 bg-primary-dark hover:bg-primary-dark-hover text-white text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50"
                      >
                        Mark as Sold
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : !feed.error && !feed.hasMore ? (
          <EmptyState
            icon={<BoxIcon />}
            title={`No ${activeTab.toLowerCase()} listings`}
            description={activeTab === 'Active' ? 'Create your first listing to start selling' : `You don't have any ${activeTab.toLowerCase()} listings right now.`}
            action={<Button href="/sell">Create Listing</Button>}
          />
        ) : null}
        <FeedStatus feed={{ ...feed, items: currentListings }} noun={`${activeTab.toLowerCase()} listings`} moreLabel="Load older listings" onRestart={handleRetry} />
      </main>
      <Footer />

      {soldModalListing && (
        <MarkAsSoldModal
          key={soldModalListing.id}
          listing={soldModalListing}
          sellerUsername={sellerUsername}
          onClose={() => setSoldModalListing(null)}
          onSold={handleSold}
        />
      )}
    </div>
  )
}
