'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { getUniversity } from '@/lib/utils'
import Navbar from '@/components/Navbar'

const TABS = [
  { label: 'All', value: 'All', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  )},
  { label: 'Product', value: 'Product', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
  )},
  { label: 'Service', value: 'Service', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  )},
  { label: 'Sublease', value: 'Sublease', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  )},
]

const CONDITION_BADGE = {
  New: 'bg-green-100 text-green-700',
  'Like New': 'bg-blue-100 text-blue-700',
  Good: 'bg-yellow-100 text-yellow-700',
  Fair: 'bg-orange-100 text-orange-700',
}

const CATEGORY_BG = {
  Product: 'from-slate-100 to-slate-200',
  Service: 'from-sky-100 to-sky-200',
  Sublease: 'from-emerald-100 to-emerald-200',
}

function ListingCard({ listing, user, onMessage }) {
  const [liked, setLiked] = useState(false)
  const sellerUsername = listing.sellerEmail?.split('@')[0] ?? 'unknown'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`relative h-52 bg-gradient-to-br ${CATEGORY_BG[listing.category] ?? 'from-gray-100 to-gray-200'} flex items-center justify-center`}>
        <span className="text-5xl text-gray-300">
          {listing.category === 'Product' ? '📦' : listing.category === 'Service' ? '🔧' : '🏠'}
        </span>
        <button
          onClick={() => setLiked(l => !l)}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow hover:scale-110 transition-transform"
        >
          <svg className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : 'fill-none text-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">{listing.title}</h3>
          {listing.condition && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${CONDITION_BADGE[listing.condition] ?? 'bg-gray-100 text-gray-600'}`}>
              {listing.condition}
            </span>
          )}
        </div>
        <p className="text-base font-bold text-green-500 mb-3">${Number(listing.price).toFixed(2)}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
              {sellerUsername[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[100px]">{sellerUsername}</span>
          </div>
          {listing.sellerEmail !== user?.email && (
            <button
              onClick={() => onMessage(listing)}
              className="flex items-center gap-1 text-xs font-medium text-white bg-green-500 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [condition, setCondition] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      try {
        const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch { /* empty or index building */ }
      finally { setFetchLoading(false) }
    }
    fetch()
  }, [user])

  const handleMessage = async (listing) => {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.email),
      where('listingId', '==', listing.id)
    )
    const snap = await getDocs(q)
    if (!snap.empty) { router.push(`/messages/${snap.docs[0].id}`); return }
    const ref = await addDoc(collection(db, 'conversations'), {
      participants: [user.email, listing.sellerEmail],
      listingId: listing.id,
      listingTitle: listing.title,
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
    router.push(`/messages/${ref.id}`)
  }

  let filtered = listings.filter(l => {
    if (activeTab !== 'All' && l.category !== activeTab) return false
    if (search && !l.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (condition && l.condition !== condition) return false
    if (minPrice !== '' && l.price < Number(minPrice)) return false
    if (maxPrice !== '' && l.price > Number(maxPrice)) return false
    return true
  })

  if (sort === 'price-asc') filtered = [...filtered].sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') filtered = [...filtered].sort((a, b) => b.price - a.price)

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const university = getUniversity(user.email)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{university} Marketplace</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                activeTab === tab.value
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + filters row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search listings"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>

          {/* Condition */}
          <select
            value={condition}
            onChange={e => setCondition(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
          >
            <option value="">Any condition</option>
            <option value="New">New</option>
            <option value="Like New">Like New</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
          </select>

          {/* Price range */}
          <div className="flex gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              placeholder="Min $"
              min="0"
              className="w-24 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="Max $"
              min="0"
              className="w-24 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Listings */}
        {fetchLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No listings found</p>
            <p className="text-sm mt-1">{listings.length === 0 ? 'Be the first to post something!' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(listing => (
              <ListingCard key={listing.id} listing={listing} user={user} onMessage={handleMessage} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
