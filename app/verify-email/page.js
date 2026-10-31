'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RESEND_COOLDOWN, sendVerification, verificationStatus } from '@/lib/email-verification.mjs'
import { useAuth } from '@/lib/auth-context'
import { authErrorMessage } from '@/lib/auth-errors.mjs'
import Footer from '@/components/Footer'
import Button from '@/components/ui/Button'

const CubeIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const MailIcon = () => (
  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </svg>
)

export default function VerifyEmailPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const pending = useRef(false)

  useEffect(() => {
    if (!user) return
    const status = verificationStatus(user.uid)
    const timer = setTimeout(() => {
      setSent(!!status.sentAt)
      setError(status.error ?? '')
      setCooldown(Math.max(0, Math.ceil(((status.sentAt ?? 0) + RESEND_COOLDOWN * 1000 - Date.now()) / 1000)))
    }, 0)
    return () => clearTimeout(timer)
  }, [user])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user?.emailVerified && !checking && !error) router.replace('/dashboard')
  }, [user, loading, checking, error, router])

  useEffect(() => {
    if (cooldown === 0) return
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (!user || cooldown > 0 || pending.current) return
    pending.current = true
    setError('')
    setSending(true)
    try {
      await sendVerification(user)
      setSent(true)
      setCooldown(RESEND_COOLDOWN)
    } catch (error) {
      setError(error.message)
    } finally {
      pending.current = false
      setSending(false)
    }
  }

  const handleContinue = async () => {
    if (!user || pending.current) return
    pending.current = true
    setError('')
    setChecking(true)
    try {
      await user.reload()
      if (user.emailVerified) {
        await user.getIdToken(true)
        router.replace('/dashboard')
      } else {
        setError("Still not verified — click the link in the email, then try again.")
      }
    } catch (error) {
      setError(authErrorMessage(error, 'verification'))
    } finally {
      pending.current = false
      setChecking(false)
    }
  }

  if (loading || !user || (user.emailVerified && !error && !checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary-dark hover:opacity-80 transition-opacity">
            <CubeIcon />
            <span className="font-bold text-xl">QuadMart</span>
          </Link>
          <button
            onClick={logout}
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary-dark flex items-center justify-center mx-auto mb-6">
            <MailIcon />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">{sent ? 'Check your inbox' : 'Verify your university email'}</h1>
          <p className="text-sm text-text-secondary mb-1">{sent ? 'We sent a verification link to' : 'Send a verification link to'}</p>
          <p className="text-sm font-semibold text-text-primary mb-6">{user.email}</p>
          <p className="text-sm text-text-secondary mb-8">
            Open the link in your university inbox, then return here and continue. Check your spam or junk folder if the email has not arrived.
          </p>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 text-left">
              {error}
            </div>
          )}

          {sent && !error && (
            <div className="bg-primary/10 border border-primary/20 text-primary-dark text-sm rounded-xl px-4 py-3 mb-4 text-left">
              Verification email sent.
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={handleContinue} loading={checking} disabled={sending} className="w-full">
              {checking ? 'Checking…' : "I've verified, continue"}
            </Button>
            <Button
              onClick={handleResend}
              variant="secondary"
              loading={sending}
              disabled={cooldown > 0 || checking}
              className="w-full"
            >
              {cooldown > 0 ? `Resend email (${cooldown}s)` : sent ? 'Resend email' : 'Send verification email'}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
