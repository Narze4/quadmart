'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { notificationFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import { markNotificationsRead, NOTIFICATION_WRITE_LIMIT } from '@/lib/notification-actions.mjs'
import FeedStatus from '@/components/FeedStatus'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'
import Skeleton from '@/components/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { timeAgo } from '@/lib/utils'

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
  if (type === 'review') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
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
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  if (loading || !user || !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <NotificationList key={`${user.uid}:${user.email}`} user={user} />
}

function NotificationList({ user }) {
  const router = useRouter()
  const [retryKey, setRetryKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const configuration = useMemo(() => ({ ...notificationFeed(db, user.uid), retryKey }), [user.uid, retryKey])
  const feed = useCursorFeed(configuration)
  const notifications = feed.items
  const unread = notifications.filter(n => !n.read)
  const toMark = unread.slice(0, NOTIFICATION_WRITE_LIMIT)
  const markRead = async (items, linkTo) => {
    if (saving || feed.denied) return
    setSaving(true); setActionError('')
    try {
      const ids = await markNotificationsRead(db, items)
      if (!active.current) return
      feed.updateItems(new Map(ids.map(id => [id, { read: true }])))
      if (typeof linkTo === 'string' && /^\/(?!\/)/.test(linkTo)) router.push(linkTo)
    } catch { if (active.current) setActionError('Could not mark these notifications as read. Please try again.') }
    finally { if (active.current) setSaving(false) }
  }

  const unreadCount = unread.length

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-text-secondary mt-0.5">{unreadCount} unread in this list</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markRead(toMark)}
              disabled={saving || feed.denied}
              className="text-sm text-primary-dark hover:opacity-80 font-medium transition-opacity"
            >
              {saving ? 'Marking as read…' : `Mark ${toMark.length} as read`}
            </button>
          )}
        </div>

        {actionError && <p role="alert" className="mb-4 text-sm text-red-700">{actionError}</p>}
        {feed.loading ? (
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
        ) : notifications.length === 0 && !feed.error ? (
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
                onClick={() => markRead([notif], notif.linkTo)}
                disabled={saving || feed.denied}
                aria-label={`${notif.read ? 'Read' : 'Unread'}: ${notif.title}`}
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
        <FeedStatus feed={feed} noun="notifications" moreLabel="Load older notifications" onRestart={() => setRetryKey(k => k + 1)} />
      </main>
      <Footer />
    </div>
  )
}
