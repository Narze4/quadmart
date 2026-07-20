'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import { timeAgo } from '@/lib/utils'

const AlertIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

function NotifIcon({ type }) {
  if (type === 'message') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
  if (type === 'cart') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  )
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

export default function NotificationsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setFetchLoading(false)
    }, () => {
      setFetchError(true)
      setFetchLoading(false)
    })
    return unsub
  }, [user, retryKey])

  const markRead = async (notif) => {
    if (!notif.read) await updateDoc(doc(db, 'notifications', notif.id), { read: true })
    if (notif.linkTo) router.push(notif.linkTo)
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read)
    if (!unread.length) return
    const batch = writeBatch(db)
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }))
    await batch.commit()
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-text-secondary mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-primary-dark hover:opacity-80 font-medium transition-opacity"
            >
              Mark all as read
            </button>
          )}
        </div>

        {fetchLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border px-4 py-4 flex items-start gap-4 bg-surface">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <EmptyState
            tone="error"
            icon={<AlertIcon />}
            title="Something went wrong"
            description="We couldn't load your notifications right now."
            action={<Button onClick={() => { setFetchLoading(true); setFetchError(false); setRetryKey(k => k + 1) }}>Try again</Button>}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            }
            title="No notifications yet"
            description="You'll see updates about your listings and messages here"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map(notif => (
              <button
                key={notif.id}
                onClick={() => markRead(notif)}
                className={`w-full text-left rounded-2xl border px-4 py-4 flex items-start gap-4 transition-all duration-200 hover:shadow-sm ${
                  notif.read
                    ? 'bg-surface border-border'
                    : 'bg-primary/5 border-primary/30 border-l-4 border-l-primary'
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${notif.read ? 'text-gray-400' : 'text-primary-dark'}`}>
                  <NotifIcon type={notif.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${notif.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                    {notif.title}
                  </p>
                  {notif.description && (
                    <p className="text-sm text-text-secondary mt-0.5 truncate">{notif.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgo(notif.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
