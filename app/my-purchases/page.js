'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, collectionGroup, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

const TABS = ['Pending', 'Completed', 'Expired']

const AlertIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

function purchaseDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MyPurchasesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Completed')
  const [transactions, setTransactions] = useState([])
  const [reviewedSellers, setReviewedSellers] = useState(new Set())
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  const fetchPurchases = async () => {
    if (!user) return
    try {
      const txSnap = await getDocs(
        query(collection(db, 'transactions'), where('buyerUid', '==', user.uid), orderBy('createdAt', 'desc'))
      )
      const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const sellerIds = [...new Set(txs.map(t => t.sellerUid).filter(Boolean))]
      const sellerNames = {}
      await Promise.all(sellerIds.map(async uid => {
        const sSnap = await getDoc(doc(db, 'users', uid))
        sellerNames[uid] = sSnap.exists() ? sSnap.data().email?.split('@')[0] : 'Unknown seller'
      }))
      setTransactions(txs.map(t => ({ ...t, sellerName: sellerNames[t.sellerUid] ?? 'Unknown seller' })))

      const reviewSnap = await getDocs(query(collectionGroup(db, 'reviews'), where('reviewerUid', '==', user.uid)))
      setReviewedSellers(new Set(reviewSnap.docs.map(d => d.ref.parent.parent.id)))
    } catch {
      setFetchError(true)
    } finally {
      setFetchLoading(false)
    }
  }

  useEffect(() => {
    // fetchPurchases is also called directly by the retry button (a plain
    // event handler), which is what trips this rule — the state updates
    // inside it only ever happen after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPurchases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleRetry = () => {
    setFetchLoading(true)
    setFetchError(false)
    fetchPurchases()
  }

  if (loading || !user || !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const counts = { Pending: 0, Completed: transactions.length, Expired: 0 }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-6 h-6 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <h1 className="text-2xl font-bold text-text-primary">My Purchases</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>

        {activeTab === 'Completed' ? (
          fetchLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-4 shadow-sm">
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <EmptyState
              tone="error"
              icon={<AlertIcon />}
              title="Something went wrong"
              description="We couldn't load your purchases right now."
              action={<Button onClick={handleRetry}>Try again</Button>}
            />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              }
              title="No completed purchases"
              description="Items you buy will show up here"
              action={<Button href="/marketplace">Browse Marketplace</Button>}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {transactions.map(tx => (
                <div key={tx.id} className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-4 shadow-sm">
                  <div className="min-w-0">
                    <h3 className="font-medium text-text-primary truncate">{tx.listingTitle}</h3>
                    <p className="text-sm font-bold text-primary-dark">${Number(tx.price).toFixed(2)}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {purchaseDate(tx.createdAt)} · from {tx.sellerName}
                    </p>
                  </div>
                  {!reviewedSellers.has(tx.sellerUid) && (
                    <Button href={`/review/${tx.sellerUid}?type=seller`} size="sm" className="shrink-0">
                      Leave a Review
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <EmptyState
            icon={
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            }
            title={`No ${activeTab.toLowerCase()} purchases`}
            description="Items you checkout will show up here"
            action={<Button href="/marketplace">Browse Marketplace</Button>}
          />
        )}
      </main>
      <Footer />
    </div>
  )
}
