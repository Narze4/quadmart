'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import Navbar from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'

function timeAgo(ts) {
  if (!ts) return ''
  const secs = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

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
    }, () => setFetchLoading(false))
    return unsub
  }, [user])

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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {fetchLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 px-4 py-4 flex items-start gap-4 bg-white">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">No notifications yet</p>
            <p className="text-sm text-gray-400">You&apos;ll see updates about your listings and messages here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map(notif => (
              <button
                key={notif.id}
                onClick={() => markRead(notif)}
                className={`w-full text-left rounded-2xl border px-4 py-4 flex items-start gap-4 transition-all duration-200 hover:shadow-sm ${
                  notif.read
                    ? 'bg-white border-gray-100'
                    : 'bg-green-50 border-green-200 border-l-4 border-l-green-500'
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${notif.read ? 'text-gray-400' : 'text-green-500'}`}>
                  <NotifIcon type={notif.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {notif.title}
                  </p>
                  {notif.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{notif.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgo(notif.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
