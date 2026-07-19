'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'

const TABS = ['Pending', 'Completed', 'Expired']

export default function MyPurchasesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Pending')

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
              {tab} (0)
            </button>
          ))}
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-9 h-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-text-primary mb-1">No {activeTab.toLowerCase()} purchases</p>
          <p className="text-sm text-text-secondary mb-5">Items you checkout will show up here</p>
          <Link
            href="/marketplace"
            className="px-5 py-2.5 bg-primary-dark hover:bg-primary-dark-hover text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95"
          >
            Browse Marketplace
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
