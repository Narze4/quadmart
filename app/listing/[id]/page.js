'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { getUniversity } from '@/lib/utils'
import { createNotification } from '@/lib/notifications'
import Navbar from '@/components/Navbar'

const CONDITION_BADGE = {
  New: 'bg-green-100 text-green-700',
  'Like New': 'bg-blue-100 text-blue-700',
  Good: 'bg-yellow-100 text-yellow-700',
  Fair: 'bg-orange-100 text-orange-700',
}

const CATEGORY_BADGE = {
  Product: 'bg-purple-100 text-purple-700',
  Service: 'bg-cyan-100 text-cyan-700',
  Sublease: 'bg-amber-100 text-amber-700',
}

export default function ListingDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { id } = useParams()
  const [listing, setListing] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [messaging, setMessaging] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [sellerUid, setSellerUid] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'listings', id)).then(async snap => {
      if (!snap.exists()) { router.replace('/marketplace'); setFetchLoading(false); return }
      const data = { id: snap.id, ...snap.data() }
      setListing(data)
      // Resolve seller UID: use stored sellerUid or look up by email
      if (data.sellerUid) {
        setSellerUid(data.sellerUid)
      } else {
        const q = query(collection(db, 'users'), where('email', '==', data.sellerEmail))
        const uSnap = await getDocs(q).catch(() => null)
        if (uSnap && !uSnap.empty) setSellerUid(uSnap.docs[0].id)
      }
      setFetchLoading(false)
    })
  }, [id, router])

  const handleMessage = async () => {
    if (!user || !listing || messaging) return
    setMessaging(true)
    try {
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
    } finally {
      setMessaging(false)
    }
  }

  const handleAddToCart = async () => {
    if (!listing || addedToCart) return
    setAddedToCart(true)
    // Notify the seller
    const sellerSnap = await getDocs(query(collection(db, 'users'), where('email', '==', listing.sellerEmail)))
    if (!sellerSnap.empty) {
      const sellerUid = sellerSnap.docs[0].id
      await createNotification(
        sellerUid,
        'cart',
        `${user.email.split('@')[0]} is interested in ${listing.title}`,
        'They added your item to their cart',
        `/listing/${listing.id}`
      )
    }
  }

  if (loading || !user || fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!listing) return null

  const images = listing.images ?? []
  const sellerUsername = listing.sellerEmail?.split('@')[0] ?? 'unknown'
  const isOwnListing = listing.sellerEmail === user.email

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Image gallery */}
          <div>
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100">
              {images[selectedImage] ? (
                <Image
                  src={images[selectedImage]}
                  alt={listing.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImage === i ? 'border-green-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image src={img} alt="" fill unoptimized className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-5">

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {listing.condition && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONDITION_BADGE[listing.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                  {listing.condition}
                </span>
              )}
              {listing.category && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CATEGORY_BADGE[listing.category] ?? 'bg-gray-100 text-gray-600'}`}>
                  {listing.category}
                </span>
              )}
            </div>

            {/* Title & price */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{listing.title}</h1>
              <p className="text-3xl font-bold text-green-500">${Number(listing.price).toFixed(2)}</p>
            </div>

            {/* Description */}
            {listing.description && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-1.5">Description</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
              </div>
            )}

            {/* Seller card */}
            {sellerUid ? (
              <Link href={`/profile/${sellerUid}`} className="flex items-center gap-3 border border-gray-200 rounded-xl p-4 bg-white hover:border-green-300 hover:bg-green-50 transition-all">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{sellerUsername}</p>
                  <p className="text-xs text-gray-500">{getUniversity(listing.sellerEmail)}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ) : (
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-4 bg-white">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{sellerUsername}</p>
                  <p className="text-xs text-gray-500">{getUniversity(listing.sellerEmail)}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            {!isOwnListing && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleMessage}
                  disabled={messaging}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {messaging ? 'Opening…' : 'Message Seller'}
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={addedToCart}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-green-500 text-green-600 font-semibold rounded-xl hover:bg-green-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  {addedToCart ? 'Added ✓' : 'Add to Cart'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
