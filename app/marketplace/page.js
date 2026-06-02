'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import Link from 'next/link'

const TABS = ['All', 'Product', 'Service', 'Sublease']

const CONDITION_COLORS = {
  New: 'bg-green-100 text-green-800',
  'Like New': 'bg-blue-100 text-blue-800',
  Good: 'bg-yellow-100 text-yellow-800',
  Fair: 'bg-orange-100 text-orange-800',
}

const CATEGORY_COLORS = {
  Product: 'bg-purple-100 text-purple-800',
  Service: 'bg-cyan-100 text-cyan-800',
  Sublease: 'bg-rose-100 text-rose-800',
}

export default function MarketplacePage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const fetchListings = async () => {
      try {
        const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(q)
        setListings(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      } catch {
        // Firestore may be empty or index building — show empty state
      } finally {
        setFetchLoading(false)
      }
    }
    fetchListings()
  }, [user])

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const filtered = listings.filter((listing) => {
    if (activeTab !== 'All' && listing.category !== activeTab) return false
    if (search && !listing.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (minPrice !== '' && listing.price < Number(minPrice)) return false
    if (maxPrice !== '' && listing.price > Number(maxPrice)) return false
    return true
  })

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#1a472a] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#1a472a] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/marketplace" className="text-white text-xl font-bold tracking-tight">
            QuadMart
          </Link>
          <div className="flex items-center gap-1 sm:gap-4">
            <Link
              href="#"
              className="px-3 py-1.5 text-sm text-green-100 hover:text-white transition-colors"
            >
              Messages
            </Link>
            <Link
              href="/sell"
              className="px-3 py-1.5 text-sm font-medium bg-white text-[#1a472a] rounded-lg hover:bg-gray-100 transition-colors"
            >
              Sell
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-green-100 hover:text-white transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Welcome, <span className="text-[#1a472a]">{user.email}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Browse listings from students on your campus.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeTab === tab
                  ? 'bg-[#1a472a] text-white border-[#1a472a]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-[#1a472a] hover:text-[#1a472a]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search + Price filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings…"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent bg-white"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min $"
              min="0"
              className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent bg-white"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max $"
              min="0"
              className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent bg-white"
            />
          </div>
        </div>

        {/* Listings grid */}
        {fetchLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1a472a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No listings found</p>
            <p className="text-sm mt-1">
              {listings.length === 0
                ? 'Be the first to post something!'
                : 'Try adjusting your filters.'}
            </p>
            <Link
              href="/sell"
              className="inline-block mt-4 px-5 py-2 bg-[#1a472a] text-white text-sm rounded-lg hover:bg-[#145222] transition-colors"
            >
              Post a listing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">
                    {listing.title}
                  </h3>
                  <span className="text-lg font-bold text-[#1a472a] whitespace-nowrap">
                    ${Number(listing.price).toFixed(2)}
                  </span>
                </div>

                {listing.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{listing.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-auto">
                  {listing.category && (
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        CATEGORY_COLORS[listing.category] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {listing.category}
                    </span>
                  )}
                  {listing.condition && (
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        CONDITION_COLORS[listing.condition] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {listing.condition}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 truncate">{listing.sellerEmail}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
