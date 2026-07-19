'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { getUniversity, getDomain } from '@/lib/utils'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import Badge from '@/components/ui/Badge'

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

const CONDITION_TONE = {
  New: 'green',
  'Like New': 'blue',
  Good: 'yellow',
  Fair: 'orange',
}

function ListingCard({ listing, user, onMessage }) {
  const [liked, setLiked] = useState(false)
  const sellerUsername = listing.sellerEmail?.split('@')[0] ?? 'unknown'

  return (
    <Link href={`/listing/${listing.id}`} className="group block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      <div className="relative h-52 overflow-hidden">
        {listing.images?.[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-52 bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
        <button
          onClick={(e) => { e.preventDefault(); setLiked(l => !l) }}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow hover:scale-110 transition-transform"
        >
          <svg className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : 'fill-none text-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-text-primary text-sm leading-snug line-clamp-2">{listing.title}</h3>
          {listing.condition && (
            <Badge tone={CONDITION_TONE[listing.condition] ?? 'neutral'}>{listing.condition}</Badge>
          )}
        </div>
        <p className="text-lg font-bold text-primary-dark mb-3">${Number(listing.price).toFixed(2)}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {listing.sellerUid ? (
              <Link
                href={`/profile/${listing.sellerUid}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 hover:opacity-75 transition-opacity"
              >
                <div className="w-6 h-6 rounded-full bg-primary-dark flex items-center justify-center text-white text-xs font-bold">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <span className="text-xs text-text-secondary truncate max-w-[100px]">{sellerUsername}</span>
              </Link>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-primary-dark flex items-center justify-center text-white text-xs font-bold">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <span className="text-xs text-text-secondary truncate max-w-[100px]">{sellerUsername}</span>
              </>
            )}
          </div>
          {listing.sellerEmail !== user?.email && (
            <button
              onClick={(e) => { e.preventDefault(); onMessage(listing) }}
              className="flex items-center gap-1 text-xs font-medium text-white bg-primary-dark hover:bg-primary-dark-hover px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
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
    </Link>
  )
}

export default function MarketplacePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [userUniversity, setUserUniversity] = useState(null)
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
    const fetchAll = async () => {
      try {
        // Fetch user profile for university
        const profileSnap = await getDoc(doc(db, 'users', user.uid))
        if (profileSnap.exists()) setUserUniversity(profileSnap.data().university)

        const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch { /* empty or index building */ }
      finally { setFetchLoading(false) }
    }
    fetchAll()
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

  const userDomain = getDomain(user?.email)
  let filtered = listings.filter(l => {
    if (getDomain(l.sellerEmail) !== userDomain) return false
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

  const university = userUniversity ?? getUniversity(user.email)

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-3xl font-bold text-text-primary mb-6">{university} Marketplace</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                activeTab === tab.value
                  ? 'bg-primary-dark text-white border-primary-dark'
                  : 'bg-surface text-text-secondary border-border hover:border-gray-300'
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
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search listings"
              className="input-field pl-9"
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="input-field sm:w-auto text-text-primary"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>

          {/* Condition */}
          <select
            value={condition}
            onChange={e => setCondition(e.target.value)}
            className="input-field sm:w-auto text-text-primary"
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
              className="input-field w-24"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="Max $"
              min="0"
              className="input-field w-24"
            />
          </div>
        </div>

        {/* Listings */}
        {fetchLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                <Skeleton className="h-52 rounded-none" />
                <div className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <svg className="w-9 h-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-text-primary mb-1">No listings found</p>
            <p className="text-sm text-text-secondary">{listings.length === 0 ? 'Be the first to post something!' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(listing => (
              <ListingCard key={listing.id} listing={listing} user={user} onMessage={handleMessage} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
