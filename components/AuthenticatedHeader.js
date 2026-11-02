'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { onSnapshot } from 'firebase/firestore'
import { unreadNotificationsQuery } from '@/lib/feed-queries.mjs'
import { getUsername } from '@/lib/utils'

const CubeIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const HeartIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const BellIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const ChevronDown = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const MenuIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const NAV_LINKS = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Sell', href: '/sell' },
  { label: 'My listings', href: '/my-listings' },
  { label: 'Purchases', href: '/my-purchases' },
  { label: 'Messages', href: '/messages' },
  { label: 'Safety', href: '/safety' },
]

export default function AuthenticatedHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isModerator } = useAuth()
  const [unread, setUnread] = useState(null)
  const unreadCount = unread && user?.emailVerified && unread.uid === user.uid ? unread.count : null
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const unsubNotificationsRef = useRef(null)
  const menuRef = useRef(null)
  const menuTriggerRef = useRef(null)
  const mobileTriggerRef = useRef(null)

  useEffect(() => {
    if (!user?.emailVerified) return
    let active = true
    const unsub = onSnapshot(
      unreadNotificationsQuery(db, user.uid), { includeMetadataChanges: true },
      snap => { if (active && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites) setUnread({ uid: user.uid, count: snap.size }) },
      () => { if (active) setUnread({ uid: user.uid, count: null }) }
    )
    unsubNotificationsRef.current = unsub
    return () => {
      active = false
      unsub()
      unsubNotificationsRef.current = null
    }
  }, [user])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuTriggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && mobileOpen) { setMobileOpen(false); mobileTriggerRef.current?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const isActive = (href) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const handleLogout = async () => {
    if (unsubNotificationsRef.current) {
      unsubNotificationsRef.current()
      unsubNotificationsRef.current = null
    }
    await logout()
    router.push('/')
  }

  const linkClass = (href) =>
    `relative px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
      isActive(href)
        ? 'text-primary-dark font-semibold'
        : 'text-text-secondary hover:text-text-primary'
    }`

  const iconClass = (href) =>
    `relative p-2 rounded-full transition-colors duration-200 ${
      isActive(href)
        ? 'bg-primary/10 text-primary-dark'
        : 'text-text-secondary hover:text-primary-dark hover:bg-primary/10'
    }`

  const username = user ? getUsername(user) : ''
  const initial = username[0]?.toUpperCase() ?? '?'

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-200 ${
        scrolled
          ? 'bg-surface/80 backdrop-blur-md border-border/80 shadow-sm'
          : 'bg-surface border-border'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 text-primary-dark hover:opacity-80 transition-opacity">
            <CubeIcon />
            <span className="font-bold text-xl">QuadMart</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5 lg:gap-1">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
                {isActive(link.href) && <span className="absolute -bottom-1 left-3 right-3 h-0.5 bg-primary rounded-full" />}
              </Link>
            ))}
            <Link href="/saved" className={iconClass('/saved')} aria-label="Saved listings">
              <HeartIcon />
            </Link>
            <Link href="/notifications" className={iconClass('/notifications')} aria-label={unreadCount === null ? 'Notifications, unread count unavailable' : `Notifications, ${unreadCount > 99 ? '99+' : unreadCount} unread`}>
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar dropdown */}
            <div className="relative ml-2" ref={menuRef}>
              <button
                ref={menuTriggerRef}
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <div className="w-9 h-9 rounded-full bg-primary-dark flex items-center justify-center text-white text-sm font-bold">
                  {initial}
                </div>
                <ChevronDown />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-2xl shadow-md py-2 z-50"
                >
                  <div className="px-4 py-2 border-b border-border mb-1">
                    <p className="text-sm font-semibold text-text-primary truncate">{username}</p>
                    <p className="text-xs text-text-secondary truncate">{user?.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-text-primary hover:bg-bg transition-colors"
                  >
                    Settings
                  </Link>
                  <Link
                    href={`/profile/${user?.uid}`}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-text-primary hover:bg-bg transition-colors"
                  >
                    My profile
                  </Link>
                  {isModerator && <Link href="/moderation" role="menuitem" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-bg">Moderation</Link>}
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); handleLogout() }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-1 lg:hidden">
            <Link href="/notifications" className={iconClass('/notifications')} aria-label={unreadCount === null ? 'Notifications, unread count unavailable' : `Notifications, ${unreadCount > 99 ? '99+' : unreadCount} unread`}>
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <button
              ref={mobileTriggerRef}
              onClick={() => setMobileOpen(o => !o)}
              className="min-h-11 min-w-11 p-2 rounded-lg text-text-secondary hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav aria-label="Mobile navigation" className="lg:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain border-t border-border bg-surface px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.href) ? 'text-primary-dark font-semibold bg-primary/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/saved"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg transition-colors"
          >
            Saved
          </Link>
          <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-border">
            <p className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">{username}</p>
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg transition-colors"
            >
              Settings
            </Link>
            <Link
              href={`/profile/${user?.uid}`}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg transition-colors"
            >
              My profile
            </Link>
            {isModerator && <Link href="/moderation" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-sm">Moderation</Link>}
            <button
              onClick={() => { setMobileOpen(false); handleLogout() }}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Log out
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
