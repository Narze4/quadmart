'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { getUniversity, getDomain } from '@/lib/utils'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import ListingCard from '@/components/ListingCard'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

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

const SearchIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const FilterIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="18" x2="20" y2="18" /><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const AlertIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const BoxIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

function FilterFields({ sort, setSort, condition, setCondition, minPrice, setMinPrice, maxPrice, setMaxPrice }) {
  return (
    <>
      <select value={sort} onChange={e => setSort(e.target.value)} className="input-field text-text-primary">
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>
      <select value={condition} onChange={e => setCondition(e.target.value)} className="input-field text-text-primary">
        <option value="">Any condition</option>
        <option value="New">New</option>
        <option value="Like New">Like New</option>
        <option value="Good">Good</option>
        <option value="Fair">Fair</option>
      </select>
      <div className="flex gap-2">
        <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Min $" min="0" className="input-field w-full" />
        <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Max $" min="0" className="input-field w-full" />
      </div>
    </>
  )
}

export default function MarketplacePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [userUniversity, setUserUniversity] = useState(null)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [condition, setCondition] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  const fetchAll = async () => {
    if (!user) return
    try {
      // Fetch user profile for university
      const profileSnap = await getDoc(doc(db, 'users', user.uid))
      if (profileSnap.exists()) setUserUniversity(profileSnap.data().university)

      const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      setFetchError(true)
    } finally {
      setFetchLoading(false)
    }
  }

  useEffect(() => {
    // fetchAll is also called directly by the retry button (a plain event
    // handler), which is what trips this rule — the state updates inside
    // it only ever happen after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleRetry = () => {
    setFetchLoading(true)
    setFetchError(false)
    fetchAll()
  }

  const userDomain = getDomain(user?.email)
  const campusListings = listings.filter(l => getDomain(l.sellerEmail) === userDomain)

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

  const activeFilterCount = [
    activeTab !== 'All',
    search.trim() !== '',
    condition !== '',
    minPrice !== '',
    maxPrice !== '',
  ].filter(Boolean).length

  const clearAll = () => {
    setActiveTab('All')
    setSearch('')
    setCondition('')
    setMinPrice('')
    setMaxPrice('')
  }

  if (loading || !user || !user.emailVerified) {
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
        <h1 className="text-3xl font-bold text-text-primary mb-1">{university} Marketplace</h1>
        {!fetchLoading && !fetchError && (
          <p className="text-sm text-text-secondary mb-6">
            Showing {filtered.length} of {campusListings.length} listing{campusListings.length === 1 ? '' : 's'}
          </p>
        )}

        {/* Large search */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
            <SearchIcon className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search listings…"
            className="input-field pl-12 py-3.5 text-base"
          />
        </div>

        {/* Category chips */}
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

        {/* Desktop filters + mobile filter trigger */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <div className="hidden sm:grid sm:grid-cols-3 gap-3 flex-1 max-w-xl">
            <FilterFields
              sort={sort} setSort={setSort}
              condition={condition} setCondition={setCondition}
              minPrice={minPrice} setMinPrice={setMinPrice}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice}
            />
          </div>

          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="sm:hidden relative flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-text-primary bg-surface"
          >
            <FilterIcon />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary-dark text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="text-sm font-medium text-primary-dark hover:underline whitespace-nowrap">
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <div className="sm:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} aria-hidden="true" />
            <div className="relative w-full bg-surface rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-text-primary text-lg">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-1.5 rounded-full hover:bg-bg text-text-secondary" aria-label="Close filters">
                  <CloseIcon />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Sort</label>
                  <select value={sort} onChange={e => setSort(e.target.value)} className="input-field text-text-primary">
                    <option value="newest">Newest</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Condition</label>
                  <select value={condition} onChange={e => setCondition(e.target.value)} className="input-field text-text-primary">
                    <option value="">Any condition</option>
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Price range</label>
                  <div className="flex gap-2">
                    <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Min $" min="0" className="input-field w-full" />
                    <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Max $" min="0" className="input-field w-full" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={clearAll} className="flex-1">Clear all</Button>
                <Button onClick={() => setMobileFiltersOpen(false)} className="flex-1">Show results</Button>
              </div>
            </div>
          </div>
        )}

        {/* Listings */}
        {fetchLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <EmptyState
            tone="error"
            icon={<AlertIcon />}
            title="Something went wrong"
            description="We couldn't load the marketplace right now."
            action={<Button onClick={handleRetry}>Try again</Button>}
          />
        ) : filtered.length === 0 ? (
          listings.length === 0 ? (
            <EmptyState
              icon={<BoxIcon />}
              title="No listings yet"
              description="Be the first to post something!"
              action={<Button href="/sell">Post the first one</Button>}
            />
          ) : (
            <EmptyState
              icon={<SearchIcon className="w-9 h-9" />}
              title="No matches"
              description="Try adjusting your filters, or browse a different category."
              action={<Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
            />
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
