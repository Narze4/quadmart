'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import Badge from '@/components/ui/Badge'

const CONDITION_TONE = {
  New: 'green',
  'Like New': 'blue',
  Good: 'yellow',
  Fair: 'orange',
}

function memberSince(ts) {
  if (!ts) return 'Unknown'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { uid } = useParams()
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Listings')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!uid) return
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', uid))
      if (!snap.exists()) { router.replace('/marketplace'); return }
      const data = { id: snap.id, ...snap.data() }
      setProfile(data)

      const q = query(
        collection(db, 'listings'),
        where('sellerEmail', '==', data.email),
        orderBy('createdAt', 'desc')
      )
      const listSnap = await getDocs(q).catch(() => ({ docs: [] }))
      setListings(listSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setFetchLoading(false)
    }
    load()
  }, [uid, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const username = profile.displayName || profile.email?.split('@')[0] || 'Unknown'
  const initial = username[0]?.toUpperCase()
  const isOwnProfile = user.uid === uid

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">

        {/* Profile header */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary-dark flex items-center justify-center text-white text-3xl font-bold shrink-0">
              {initial}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-text-primary">{username}</h1>
              {profile.university && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 text-text-secondary">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
                  </svg>
                  <span className="text-sm">{profile.university}</span>
                </div>
              )}
              <p className="text-xs text-text-secondary mt-1">Member since {memberSince(profile.createdAt)}</p>

              {isOwnProfile && (
                <Link
                  href="/settings"
                  className="inline-block mt-3 px-4 py-1.5 text-sm font-medium border border-border text-text-secondary rounded-xl hover:bg-bg transition-all duration-200 active:scale-95"
                >
                  Edit Profile
                </Link>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 sm:gap-8 shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-dark">{profile.sellerScore ?? 100}</p>
                <p className="text-xs text-text-secondary mt-0.5">Seller Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{profile.buyerScore ?? 100}</p>
                <p className="text-xs text-text-secondary mt-0.5">Buyer Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary">{profile.transactions ?? 0}</p>
                <p className="text-xs text-text-secondary mt-0.5">Transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {['Listings', 'Reviews'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab} {tab === 'Listings' && `(${listings.length})`}
            </button>
          ))}
        </div>

        {/* Listings tab */}
        {activeTab === 'Listings' && (
          fetchLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                  <Skeleton className="h-44 rounded-none" />
                  <div className="p-3 flex flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="w-9 h-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p className="text-base font-semibold text-text-primary">No listings yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map(listing => (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="group block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="relative h-44 overflow-hidden">
                    {listing.images?.[0] ? (
                      <Image src={listing.images[0]} alt={listing.title} fill unoptimized className="object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-text-primary text-sm leading-snug line-clamp-2">{listing.title}</h3>
                      {listing.condition && (
                        <Badge tone={CONDITION_TONE[listing.condition] ?? 'neutral'}>{listing.condition}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-bold text-primary-dark">${Number(listing.price).toFixed(2)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Reviews tab */}
        {activeTab === 'Reviews' && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-text-secondary">
            <svg className="w-10 h-10 mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <p className="text-base font-medium text-text-secondary">No reviews yet</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
