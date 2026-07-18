'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { getUniversity, getUsername, getDomain } from '@/lib/utils'
import Navbar from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'

const CONDITION_BADGE = {
  New: 'bg-green-100 text-green-700',
  'Like New': 'bg-blue-100 text-blue-700',
  Good: 'bg-yellow-100 text-yellow-700',
  Fair: 'bg-orange-100 text-orange-700',
}

function ListingCard({ listing, user }) {
  const [liked, setLiked] = useState(false)
  const sellerUsername = listing.sellerEmail?.split('@')[0] ?? 'unknown'

  return (
    <Link href={`/listing/${listing.id}`} className="group block bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        {listing.images?.[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
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

      {/* Content */}
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
              onClick={(e) => e.preventDefault()}
              className="flex items-center gap-1 text-xs font-medium text-white bg-green-500 hover:bg-green-700 px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
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

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [userUniversity, setUserUniversity] = useState(null)

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
      } catch { /* empty collection or index building */ }
      finally { setFetchLoading(false) }
    }
    fetchAll()
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const university = userUniversity ?? getUniversity(user.email)
  const username = getUsername(user)
  const userDomain = getDomain(user.email)
  const featured = listings.filter(l => getDomain(l.sellerEmail) === userDomain).slice(0, 6)
  const showAll = featured.length === 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-0 max-w-7xl mx-auto">
        <div
          className="relative overflow-hidden rounded-2xl p-8 sm:p-12 text-white"
          style={{ background: 'linear-gradient(135deg, #2d8a5e 0%, #1a5c3a 100%)' }}
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -bottom-16 right-24 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">Welcome back, {username} 👋</h1>
            <p className="text-green-100 text-sm sm:text-base mb-6">
              Here&apos;s what&apos;s trending at {university}
            </p>
            <Link
              href="/marketplace"
              className="inline-block px-6 py-2.5 border-2 border-white text-white text-sm font-semibold rounded-xl hover:bg-white hover:text-green-700 transition-all duration-200 active:scale-95"
            >
              Go to Marketplace
            </Link>
          </div>
        </div>
      </div>

      {/* Featured listings */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {showAll ? 'Recent Listings' : `Featured for ${university}`}
        </h2>

        {fetchLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <Skeleton className="h-48 rounded-none" />
                <div className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (showAll ? listings : featured).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No listings yet</p>
            <Link href="/sell" className="inline-block mt-4 px-5 py-2 bg-green-500 text-white text-sm rounded-xl hover:bg-green-700 transition-all duration-200 active:scale-95">
              Post the first one
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(showAll ? listings : featured).map(listing => (
              <ListingCard key={listing.id} listing={listing} user={user} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
