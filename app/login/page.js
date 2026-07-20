'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PublicHeader from '@/components/PublicHeader'
import Footer from '@/components/Footer'
import Button from '@/components/ui/Button'

const BENEFITS = [
  'See listings only from your own campus',
  'Message buyers and sellers directly',
  'Verified with your university email',
]

const COLLAGE_ITEMS = ['📚', '🛋️', '💻', '🚲']

const CubeIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const EyeIcon = () => (
  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 4.22-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const GRADIENT = 'linear-gradient(135deg, #2d8a5e 0%, #1a5c3a 55%, #123d27 100%)'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      router.push(user.emailVerified ? '/dashboard' : '/verify-email')
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setResetError('')
    setResetSending(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetSent(true)
    } catch (err) {
      setResetError('Could not send a reset email to that address. Please check it and try again.')
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicHeader />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Brand panel — desktop */}
        <div
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden text-white flex-col justify-center px-12 xl:px-20 py-16"
          style={{ background: GRADIENT }}
        >
          <div
            className="absolute inset-0 opacity-[0.06]"
            aria-hidden="true"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          />
          <div className="relative max-w-sm">
            <div className="flex items-center gap-2 mb-8">
              <CubeIcon />
              <span className="font-bold text-xl">QuadMart</span>
            </div>
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Your campus, your marketplace.
            </h2>
            <p className="text-green-100 mb-8">
              QuadMart is built exclusively for verified students — no strangers, no spam, just your own campus.
            </p>
            <ul className="flex flex-col gap-3 mb-10">
              {BENEFITS.map(b => (
                <li key={b} className="flex items-center gap-3 text-sm text-white">
                  <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <CheckIcon />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              {COLLAGE_ITEMS.map((icon, i) => (
                <div key={i} className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl">
                  {icon}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Brand banner — mobile */}
        <div className="lg:hidden text-white text-center px-6 py-8" style={{ background: GRADIENT }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <CubeIcon />
            <span className="font-bold text-lg">QuadMart</span>
          </div>
          <p className="text-sm text-green-100">Student-only. Verified by your university email.</p>
        </div>

        {/* Form panel */}
        <div className="flex-1 flex items-center justify-center px-4 py-12 lg:py-16">
          <div className="w-full max-w-[420px]">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Welcome back</h1>
            <p className="text-sm text-text-secondary mb-8">
              Log in to your QuadMart account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  required
                  className="input-field"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-text-primary">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowReset(s => !s)}
                    className="text-xs font-medium text-primary-dark hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    className="input-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {showReset && (
                <div className="bg-bg border border-border rounded-xl p-4">
                  {resetSent ? (
                    <p className="text-sm text-primary-dark">
                      If an account exists for that email, a reset link is on its way.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@university.edu"
                          className="input-field"
                        />
                        <Button type="button" variant="secondary" size="sm" loading={resetSending} onClick={handleReset}>
                          Send
                        </Button>
                      </div>
                      {resetError && <p className="text-xs text-red-600">{resetError}</p>}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" loading={loading} className="w-full">
                {loading ? 'Logging in…' : 'Log In'}
              </Button>
            </form>

            <p className="text-sm text-center text-text-secondary mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-primary-dark font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
