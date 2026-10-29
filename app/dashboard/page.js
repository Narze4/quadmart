'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { recentListingsFeed, marketplaceFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import FeedStatus from '@/components/FeedStatus'
import { getUniversity, getUsername, getCampusId } from '@/lib/utils'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import ListingCard from '@/components/ListingCard'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

const CATEGORY_META = {
  Product: { icon: '📦' },
  Service: { icon: '🛠️' },
  Sublease: { icon: '🏠' },
}

const SearchIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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

export default function DashboardPage() {
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

  return <CampusDashboard key={`${user.uid}:${user.email}`} user={user} />
}

function CampusDashboard({ user }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [settledSearch, setSettledSearch] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  useEffect(() => { const timer = setTimeout(() => setSettledSearch(search.trim()), 300); return () => clearTimeout(timer) }, [search])
  const searching = !!settledSearch || category !== 'All'
  const pending = settledSearch !== search.trim()
  const campusId = getCampusId(user.email)
  const configuration = useMemo(() => ({
    ...(searching ? { loadPage: marketplaceFeed(db, campusId, { category, search: settledSearch, condition: '', sort: 'newest', minPrice: '', maxPrice: '' }) } : recentListingsFeed(db, campusId)), retryKey,
  }), [campusId, category, settledSearch, searching, retryKey])
  const feed = useCursorFeed(configuration)
  const source = feed.items
  const recent = source
  const searchResults = searching ? source : null
  const fetchLoading = feed.loading || pending
  const fetchError = !!feed.error && !source.length
  const handleRetry = () => setRetryKey(k => k + 1)
  const university = getUniversity(user.email)
  const username = getUsername(user)

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />

      {/* Compact header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-0 max-w-7xl mx-auto w-full">
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-6 sm:px-8 sm:py-7 text-white"
          style={{ background: 'linear-gradient(135deg, #2d8a5e 0%, #1a5c3a 100%)' }}
        >
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -bottom-10 right-20 w-20 h-20 rounded-full bg-white/10" aria-hidden="true" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Welcome back, {username} 👋</h1>
              <p className="text-green-100 text-sm">{university}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search your campus listings…"
                  className="w-full sm:w-64 pl-9 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center px-4 py-2.5 border-2 border-white text-white text-sm font-semibold rounded-xl hover:bg-white hover:text-primary-dark transition-all duration-200 active:scale-95 whitespace-nowrap"
                >
                  Browse marketplace
                </Link>
                <Link
                  href="/sell"
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-white text-primary-dark text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95 whitespace-nowrap"
                >
                  Create listing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex flex-col gap-12">
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
            description="We couldn't load your campus listings right now."
            action={<Button onClick={handleRetry}>Try again</Button>}
          />
        ) : searchResults !== null ? (
          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              {settledSearch ? `Results for “${settledSearch}”` : category}
            </h2>
            {searchResults.length === 0 ? (
              <EmptyState
                icon={<SearchIcon />}
                title={feed.hasMore ? "No matches in this batch" : "No matches"}
                description={feed.hasMore ? "More campus listings remain to search." : "Try another search or category."}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map(listing => <ListingCard key={listing.id} listing={listing} />)}
              </div>
            )}
            <FeedStatus feed={feed} noun="listings" moreLabel={source.length ? 'Load more matches' : 'Continue searching'} onRestart={handleRetry} />
            <Button className="mt-3" variant="ghost" onClick={() => { setSearch(''); setCategory('All') }}>Clear search</Button>
          </section>
        ) : source.length === 0 ? (
          <EmptyState
            icon={<BoxIcon />}
            title="No listings yet"
            description="Be the first to post something at your school."
            action={<Button href="/sell">Post the first one</Button>}
          />
        ) : (
          <>
            {recent.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-text-primary mb-4">Recently added</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recent.map(listing => <ListingCard key={listing.id} listing={listing} />)}
                </div>
              </section>
            )}

          </>
        )}
        {!searching && !fetchLoading && !fetchError && <section aria-label="Browse by category">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Browse by category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{Object.entries(CATEGORY_META).map(([name, meta]) => <button key={name} onClick={() => setCategory(name)} className="flex items-center gap-4 text-left bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md">
            <span className="text-2xl" aria-hidden="true">{meta.icon}</span><span className="font-semibold text-text-primary">{name}</span>
          </button>)}</div>
        </section>}
      </main>

      <Footer />
    </div>
  )
}
