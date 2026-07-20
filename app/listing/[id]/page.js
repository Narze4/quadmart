'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { getUniversity, getListingStatus } from '@/lib/utils'
import { createNotification } from '@/lib/notifications'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Badge from '@/components/ui/Badge'
import CategoryPlaceholder from '@/components/CategoryPlaceholder'

const CONDITION_TONE = {
  New: 'green',
  'Like New': 'blue',
  Good: 'yellow',
  Fair: 'orange',
}

const CATEGORY_TONE = {
  Product: 'purple',
  Service: 'cyan',
  Sublease: 'amber',
}

export default function ListingDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { id } = useParams()
  const [listing, setListing] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [messaging, setMessaging] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [addedToCart, setAddedToCart] = useState(false)
  const [sellerUid, setSellerUid] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
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
    if (!user || !listing || messaging || !sellerUid) return
    setMessaging(true)
    setMessageError('')
    try {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid),
        where('listingId', '==', listing.id)
      )
      const snap = await getDocs(q)
      if (!snap.empty) { router.push(`/messages/${snap.docs[0].id}`); return }
      const ref = await addDoc(collection(db, 'conversations'), {
        participants: [user.uid, sellerUid],
        participantEmails: [user.email, listing.sellerEmail],
        listingId: listing.id,
        listingTitle: listing.title,
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      })
      router.push(`/messages/${ref.id}`)
    } catch (err) {
      console.error('Failed to open conversation:', err)
      setMessageError("Couldn't message this seller right now. Please try again.")
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

  if (loading || !user || !user.emailVerified || fetchLoading) {
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
  const status = getListingStatus(listing)

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {status === 'reserved' && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-medium">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Reserved — this item is being held for another buyer
          </div>
        )}
        {status === 'sold' && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Sold — this item is no longer available
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">

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
                <CategoryPlaceholder category={listing.category} />
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden transition-all duration-200 shrink-0 ${
                      selectedImage === i ? 'ring-2 ring-primary ring-offset-2' : 'ring-1 ring-gray-200 hover:ring-gray-300'
                    }`}
                  >
                    <Image src={img} alt="" fill unoptimized className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-24">

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {listing.condition && (
                <Badge tone={CONDITION_TONE[listing.condition] ?? 'neutral'}>{listing.condition}</Badge>
              )}
              {listing.category && (
                <Badge tone={CATEGORY_TONE[listing.category] ?? 'neutral'}>{listing.category}</Badge>
              )}
            </div>

            {/* Title & price */}
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">{listing.title}</h1>
              <p className="text-3xl font-bold text-primary-dark">${Number(listing.price).toFixed(2)}</p>
            </div>

            {/* Description */}
            {listing.description && (
              <div>
                <h2 className="text-sm font-semibold text-text-primary mb-1.5">Description</h2>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{listing.description}</p>
              </div>
            )}

            {/* Seller card */}
            {sellerUid ? (
              <Link href={`/profile/${sellerUid}`} className="flex items-center gap-3 border border-border rounded-2xl p-4 bg-surface shadow-sm hover:shadow-md hover:border-primary/40 hover:bg-primary/5 transition-all duration-200">
                <div className="w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{sellerUsername}</p>
                  <p className="text-xs text-text-secondary">{getUniversity(listing.sellerEmail)}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ) : (
              <div className="flex items-center gap-3 border border-border rounded-2xl p-4 bg-surface shadow-sm">
                <div className="w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{sellerUsername}</p>
                  <p className="text-xs text-text-secondary">{getUniversity(listing.sellerEmail)}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            {!isOwnListing && status !== 'sold' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleMessage}
                  disabled={messaging || !sellerUid}
                  title={!sellerUid ? 'Sample listing — messaging unavailable' : undefined}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-dark hover:bg-primary-dark-hover text-white font-semibold text-base rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {messaging ? 'Opening…' : 'Message Seller'}
                </button>
                {!sellerUid && (
                  <p className="text-xs text-text-secondary text-center -mt-2">Sample listing — messaging unavailable</p>
                )}
                {messageError && (
                  <p className="text-sm text-red-600 text-center -mt-2">{messageError}</p>
                )}
                <button
                  onClick={handleAddToCart}
                  disabled={addedToCart}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-primary text-primary-dark font-semibold rounded-xl hover:bg-primary/10 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
      <Footer />
    </div>
  )
}
