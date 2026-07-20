'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import ListingCard from '@/components/ListingCard'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

const HeartIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

export default function SavedPage() {
  const { user, loading, savedListings } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const ids = [...savedListings].reverse()
    Promise.all(ids.map(id => getDoc(doc(db, 'listings', id)))).then(snaps => {
      if (cancelled) return
      setListings(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })))
      setFetchLoading(false)
    })
    return () => { cancelled = true }
  }, [user, savedListings])

  if (loading || !user || !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-text-secondary">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <h1 className="text-2xl font-bold text-text-primary">Saved</h1>
          </div>
        </div>

        {fetchLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<HeartIcon />}
            title="No saved items yet"
            description="Tap the heart on any listing to save it here"
            action={<Button href="/marketplace">Browse Marketplace</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
