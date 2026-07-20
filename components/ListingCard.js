'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Badge from '@/components/ui/Badge'
import CategoryPlaceholder from '@/components/CategoryPlaceholder'
import { getUniversity, timeAgo, getListingStatus } from '@/lib/utils'
import { isSampleSeller } from '@/lib/sellers'

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

const HeartIcon = ({ filled }) => (
  <svg className={`w-4 h-4 ${filled ? 'fill-red-500 text-red-500' : 'fill-none text-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const CheckBadgeIcon = () => (
  <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ImagesIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="14" rx="2" />
    <path d="M3 13l4-4a2 2 0 0 1 2.8 0L15 14" />
    <circle cx="16" cy="8" r="1.5" />
  </svg>
)

const ArrowIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export default function ListingCard({ listing, showSeller = true }) {
  const [liked, setLiked] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [isSample, setIsSample] = useState(false)
  const sellerUsername = listing.sellerEmail?.split('@')[0] ?? 'unknown'
  const hasImage = listing.images?.[0] && !imgError
  const imageCount = listing.images?.length ?? 0
  const status = getListingStatus(listing)

  useEffect(() => {
    let cancelled = false
    isSampleSeller(listing).then(result => { if (!cancelled) setIsSample(result) })
    return () => { cancelled = true }
  }, [listing])

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:transition-all motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        {hasImage ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            unoptimized
            onError={() => setImgError(true)}
            className="object-cover motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-safe:duration-300"
          />
        ) : (
          <CategoryPlaceholder category={listing.category} />
        )}

        {listing.category && (
          <Badge tone={CATEGORY_TONE[listing.category] ?? 'neutral'} className="absolute top-3 right-3 shadow-sm">
            {listing.category}
          </Badge>
        )}

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLiked(l => !l) }}
          aria-label={liked ? 'Remove from favorites' : 'Add to favorites'}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow motion-safe:hover:scale-110 motion-safe:transition-transform"
        >
          <HeartIcon filled={liked} />
        </button>

        {imageCount > 1 && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-full">
            <ImagesIcon />
            {imageCount}
          </span>
        )}

        {status !== 'active' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-4 py-1.5 rounded-full bg-white/90 text-text-primary text-xs font-bold uppercase tracking-wide">
              {status}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-text-primary text-sm leading-snug line-clamp-2">{listing.title}</h3>
          {listing.condition && (
            <Badge tone={CONDITION_TONE[listing.condition] ?? 'neutral'}>{listing.condition}</Badge>
          )}
        </div>
        <p className="text-lg font-bold text-primary-dark mb-2">${Number(listing.price).toFixed(2)}</p>

        <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
          <span className="truncate">{getUniversity(listing.sellerEmail)}</span>
          {listing.createdAt && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{timeAgo(listing.createdAt)}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {isSample ? (
            <span className="text-xs font-medium text-text-secondary">Sample listing</span>
          ) : showSeller ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative w-6 h-6 shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary-dark flex items-center justify-center text-white text-xs font-bold">
                  {sellerUsername[0]?.toUpperCase()}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary flex items-center justify-center ring-2 ring-surface"
                  title="Verified student"
                >
                  <CheckBadgeIcon />
                </span>
              </div>
              <span className="text-xs text-text-secondary truncate">{sellerUsername}</span>
            </div>
          ) : <span />}

          <span className="text-xs font-medium text-primary-dark opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-opacity flex items-center gap-0.5 shrink-0">
            View listing
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  )
}
