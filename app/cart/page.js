'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'

export default function CartPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-text-secondary">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <h1 className="text-2xl font-bold text-text-primary">Shopping Cart</h1>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <svg className="w-9 h-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary mb-1">Your cart is empty</p>
          <p className="text-sm text-text-secondary mb-6">Nothing here yet — go find something great on the marketplace</p>
          <Link
            href="/marketplace"
            className="px-6 py-2.5 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95"
          >
            Browse Marketplace
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
