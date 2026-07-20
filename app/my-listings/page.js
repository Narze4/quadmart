'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { getListingStatus, getUsername } from '@/lib/utils'
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

const AlertIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const BoxIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

export default function MyListingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [activeTab, setActiveTab] = useState('Active')
  const [updatingId, setUpdatingId] = useState(null)
  const [soldModalListing, setSoldModalListing] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  const fetchListings = async () => {
    if (!user) return
    try {
      const q = query(collection(db, 'listings'), where('sellerEmail', '==', user.email))
      const snap = await getDocs(q)
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      }))
    } catch {
      setFetchError(true)
    } finally {
      setFetchLoading(false)
    }
  }

  useEffect(() => {
    // fetchListings is also called directly by the retry button (a plain
    // event handler), which is what trips this rule — the state updates
    // inside it only ever happen after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleRetry = () => {
    setFetchLoading(true)
    setFetchError(false)
    fetchListings()
  }

  const setLocalStatus = (id, status) => {
    setListings(prev => prev.map(l => (l.id === id ? { ...l, status } : l)))
  }

  const handleSetStatus = async (listing, status) => {
    setUpdatingId(listing.id)
    try {
      await updateDoc(doc(db, 'listings', listing.id), { status })
      setLocalStatus(listing.id, status)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSold = () => {
    setLocalStatus(soldModalListing.id, 'sold')
    setSoldModalListing(null)
  }

  if (loading || !user || !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const byStatus = {
    Active: listings.filter(l => getListingStatus(l) === 'active'),
    Reserved: listings.filter(l => getListingStatus(l) === 'reserved'),
    Sold: listings.filter(l => getListingStatus(l) === 'sold'),
  }
  const currentListings = byStatus[activeTab]
  const sellerUsername = getUsername(user)

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
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab} ({byStatus[tab].length})
            </button>
          ))}
        </div>

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
        ) : fetchError ? (
          <EmptyState
            tone="error"
            icon={<AlertIcon />}
            title="Something went wrong"
            description="We couldn't load your listings right now."
            action={<Button onClick={handleRetry}>Try again</Button>}
          />
        ) : currentListings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {currentListings.map(listing => {
              const status = getListingStatus(listing)
              const isUpdating = updatingId === listing.id
              return (
                <div key={listing.id} className="bg-surface rounded-2xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:shadow-md transition-all duration-200">
                  <Link href={`/listing/${listing.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                      {listing.images?.[0] ? (
                        <Image src={listing.images[0]} alt={listing.title} fill unoptimized className="object-cover" />
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
                          disabled={isUpdating}
                          className="px-3 py-2 border border-border text-text-primary text-xs font-semibold rounded-xl hover:bg-bg transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                          Mark as Reserved
                        </button>
                      )}
                      {status === 'reserved' && (
                        <button
                          onClick={() => handleSetStatus(listing, 'active')}
                          disabled={isUpdating}
                          className="px-3 py-2 border border-border text-text-primary text-xs font-semibold rounded-xl hover:bg-bg transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                          Back to Active
                        </button>
                      )}
                      <button
                        onClick={() => setSoldModalListing(listing)}
                        disabled={isUpdating}
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
        ) : (
          <EmptyState
            icon={<BoxIcon />}
            title={`No ${activeTab.toLowerCase()} listings`}
            description={activeTab === 'Active' ? 'Create your first listing to start selling' : `You don't have any ${activeTab.toLowerCase()} listings right now.`}
            action={<Button href="/sell">Create Listing</Button>}
          />
        )}
      </main>
      <Footer />

      {soldModalListing && (
        <MarkAsSoldModal
          listing={soldModalListing}
          sellerUsername={sellerUsername}
          onClose={() => setSoldModalListing(null)}
          onSold={handleSold}
        />
      )}
    </div>
  )
}
