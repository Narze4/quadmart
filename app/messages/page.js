'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import Navbar from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'

export default function MessagesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.email))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0
          const bTime = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0
          return bTime - aTime
        })
      setConversations(docs)
      setFetchLoading(false)
    }, () => setFetchLoading(false))
    return unsubscribe
  }, [user])

  const otherParticipant = (participants) =>
    participants?.find((p) => p !== user.email) ?? 'Unknown'

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Messages</h1>

        {fetchLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-1">No messages yet</p>
            <p className="text-sm text-gray-400 mb-5">Message a seller from the marketplace to get started</p>
            <Link href="/marketplace" className="inline-block px-5 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200 active:scale-95">
              Browse listings
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm hover:shadow-md hover:border-green-400 transition-all duration-200 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {otherParticipant(conv.participants)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{otherParticipant(conv.participants)}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">Re: {conv.listingTitle ?? 'Listing'}</p>
                  {conv.lastMessage && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
