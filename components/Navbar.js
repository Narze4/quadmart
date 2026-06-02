'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'

const CubeIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const CartIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)

const BellIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    )
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size))
    return unsub
  }, [user])

  const isActive = (href) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const linkClass = (href) =>
    `px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
      isActive(href)
        ? 'bg-gray-100 text-gray-900'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`

  const iconClass = (href) =>
    `p-2 rounded-full transition-colors ${
      isActive(href)
        ? 'bg-gray-100 text-gray-900'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 text-green-500 hover:text-green-600 transition-colors">
            <CubeIcon />
            <span className="font-bold text-xl">QuadMart</span>
          </Link>

          {/* Nav */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link href="/sell" className={linkClass('/sell')}>Sell</Link>
            <Link href="/my-listings" className={linkClass('/my-listings')}>
              <span className="hidden sm:inline">My Listings</span>
              <span className="sm:hidden">Listings</span>
            </Link>
            <Link href="/cart" className={iconClass('/cart')} aria-label="Cart">
              <CartIcon />
            </Link>
            <Link href="/notifications" className={`relative ${iconClass('/notifications')}`} aria-label="Notifications">
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link href="/my-purchases" className={linkClass('/my-purchases')}>
              <span className="hidden sm:inline">My Purchases</span>
              <span className="sm:hidden">Purchases</span>
            </Link>
            <Link href="/messages" className={linkClass('/messages')}>Messages</Link>
            <Link href="/settings" className={linkClass('/settings')}>Settings</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
