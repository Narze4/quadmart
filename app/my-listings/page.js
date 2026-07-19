'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import Badge from '@/components/ui/Badge'

const TABS = ['Active', 'Reserved', 'Sold']

const CONDITION_TONE = {
  New: 'green',
  'Like New': 'blue',
  Good: 'yellow',
  Fair: 'orange',
}

export default function MyListingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Active')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      try {
        const q = query(collection(db, 'listings'), where('sellerEmail', '==', user.email))
        const snap = await getDocs(q)
        setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        }))
      } catch { /* empty */ }
      finally { setFetchLoading(false) }
    }
    fetch()
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeListings = listings // All listings are "Active" for now

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
          <div className="flex items-center gap-3">
            <select className="input-field sm:w-auto text-text-secondary">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>All time</option>
            </select>
            <Link
              href="/sell"
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Listing
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {TABS.map(tab => {
            const count = tab === 'Active' ? activeListings.length : 0
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary-dark'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab} ({count})
              </button>
            )
          })}
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
        ) : activeTab === 'Active' && activeListings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {activeListings.map(listing => (
              <div key={listing.id} className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="relative w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {listing.images?.[0] ? (
                    <Image src={listing.images[0]} alt={listing.title} fill unoptimized className="object-cover" />
                  ) : (
                    <svg className="w-7 h-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-text-primary truncate">{listing.title}</h3>
                  <p className="text-sm font-bold text-primary-dark">${Number(listing.price).toFixed(2)}</p>
                </div>
                {listing.condition && (
                  <Badge tone={CONDITION_TONE[listing.condition] ?? 'neutral'}>{listing.condition}</Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-text-primary mb-1">No listings yet</p>
            <p className="text-sm text-text-secondary mb-5">Create your first listing to start selling</p>
            <Link
              href="/sell"
              className="px-5 py-2.5 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95"
            >
              Create Listing
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
