'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

const StarIcon = ({ filled }) => (
  <svg
    className={`w-9 h-9 transition-colors ${filled ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-gray-300'}`}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" /><polyline points="9 12 12 15 16 9" />
  </svg>
)

export default function ReviewPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { sellerUid } = useParams()
  const searchParams = useSearchParams()
  const type = searchParams.get('type') === 'buyer' ? 'buyer' : 'seller'

  const [target, setTarget] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !sellerUid) return
    if (sellerUid === user.uid) { router.replace('/my-purchases'); return }

    const load = async () => {
      try {
        const targetSnap = await getDoc(doc(db, 'users', sellerUid))
        if (!targetSnap.exists()) { router.replace('/my-purchases'); return }
        setTarget({ id: targetSnap.id, ...targetSnap.data() })

        const reviewSnap = await getDocs(
          query(collection(db, 'users', sellerUid, 'reviews'), where('reviewerUid', '==', user.uid))
        )
        if (!reviewSnap.empty) setAlreadyReviewed(true)
      } finally {
        setFetchLoading(false)
      }
    }
    load()
  }, [user, sellerUid, router])

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(db, 'users', sellerUid, 'reviews'), {
        reviewerUid: user.uid,
        rating,
        comment: comment.trim(),
        type,
        createdAt: serverTimestamp(),
      })

      const allReviewsSnap = await getDocs(
        query(collection(db, 'users', sellerUid, 'reviews'), where('type', '==', type))
      )
      const ratings = allReviewsSnap.docs.map(d => d.data().rating).filter(r => typeof r === 'number')
      const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      const scoreField = type === 'seller' ? 'sellerScore' : 'buyerScore'
      await updateDoc(doc(db, 'users', sellerUid), { [scoreField]: Math.round(avg * 20) })

      setSubmitted(true)
    } catch {
      setError('Failed to submit your review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user || !user.emailVerified || fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const targetUsername = target?.email?.split('@')[0] ?? 'this user'

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-md mx-auto px-4 sm:px-6 py-12 w-full">
        {submitted || alreadyReviewed ? (
          <EmptyState
            icon={<CheckIcon />}
            title="Review submitted"
            description={`Thanks for letting us know about your experience with ${targetUsername}.`}
            action={<Button href="/my-purchases">Back to My Purchases</Button>}
          />
        ) : (
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 sm:p-8">
            <h1 className="text-xl font-bold text-text-primary mb-1">Leave a review</h1>
            <p className="text-sm text-text-secondary mb-6">How was your experience with {targetUsername}?</p>

            <div className="flex items-center justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  className="p-1"
                >
                  <StarIcon filled={star <= (hoverRating || rating)} />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              rows={4}
              className="input-field w-full mb-4 resize-none"
            />

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <Button onClick={handleSubmit} disabled={rating === 0 || submitting} className="w-full">
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
