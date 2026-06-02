'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import Navbar from '@/components/Navbar'

const TABS = ['Active', 'Reserved', 'Sold']

const CONDITION_BADGE = {
  New: 'bg-green-100 text-green-700',
  'Like New': 'bg-blue-100 text-blue-700',
  Good: 'bg-yellow-100 text-yellow-700',
  Fair: 'bg-orange-100 text-orange-700',
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <h1 className="text-xl font-bold text-gray-900">My Listings</h1>
          </div>
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-600 focus:outline-none">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>All time</option>
            </select>
            <Link
              href="/sell"
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Listing
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 mb-6">
          {TABS.map(tab => {
            const count = tab === 'Active' ? activeListings.length : 0
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab} ({count})
              </button>
            )
          })}
        </div>

        {/* Content */}
        {fetchLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'Active' && activeListings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {activeListings.map(listing => (
              <div key={listing.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
                <div className="relative w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {listing.images?.[0] ? (
                    <Image src={listing.images[0]} alt={listing.title} fill unoptimized className="object-cover" />
                  ) : (
                    <svg className="w-7 h-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{listing.title}</h3>
                  <p className="text-sm font-bold text-green-500">${Number(listing.price).toFixed(2)}</p>
                </div>
                {listing.condition && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONDITION_BADGE[listing.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                    {listing.condition}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <p className="text-base font-semibold text-gray-700 mb-1">No listings yet</p>
            <p className="text-sm text-gray-400 mb-5">Create your first listing to start selling</p>
            <Link
              href="/sell"
              className="px-5 py-2.5 bg-green-500 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Create Listing
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
