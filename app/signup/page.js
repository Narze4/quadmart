'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PublicHeader from '@/components/PublicHeader'
import Footer from '@/components/Footer'
import Button from '@/components/ui/Button'
import { UNIVERSITIES, getUniversityFromEmail } from '@/lib/universities'

const FIREBASE_ERRORS = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
}

const BENEFITS = [
  'See listings only from your own campus',
  'Message buyers and sellers directly',
  'Verified with your university email',
]

const COLLAGE_ITEMS = ['📚', '🛋️', '💻', '🚲']

const GRADIENT = 'linear-gradient(135deg, #2d8a5e 0%, #1a5c3a 55%, #123d27 100%)'

const CubeIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const AlertIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
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

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const trimmedEmail = email.trim()
  const isEduEmail = trimmedEmail.endsWith('.edu')
  const matchedUniversity = isEduEmail ? getUniversityFromEmail(trimmedEmail) : null
  const showUnsupported = isEduEmail && trimmedEmail.includes('@') && !matchedUniversity

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!trimmedEmail.endsWith('.edu')) {
      setError('Only .edu email addresses are allowed. Please use your university email.')
      return
    }

    const university = getUniversityFromEmail(trimmedEmail)
    if (!university) {
      setError("QuadMart isn't at your school yet.")
      return
    }

    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        university: university.name,
        sellerScore: 100,
        buyerScore: 100,
        transactions: 0,
        createdAt: serverTimestamp(),
      })
      await sendEmailVerification(user)
      router.push('/verify-email')
    } catch (err) {
      setError(FIREBASE_ERRORS[err.code] ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
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
              Sign up with your university email and we&apos;ll match you to your campus automatically.
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
            <h1 className="text-3xl font-bold text-text-primary mb-1">Create your account</h1>
            <p className="text-sm text-text-secondary mb-8">
              Use your university email — we&apos;ll figure out your campus from the domain.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">University Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@youruniversity.edu"
                  required
                  autoFocus
                  className="input-field"
                />
              </div>

              {matchedUniversity && (
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-dark text-sm rounded-xl px-4 py-3">
                  <CheckIcon />
                  <span>
                    You&apos;re joining <span className="font-semibold">{matchedUniversity.name}</span>
                  </span>
                </div>
              )}

              {showUnsupported && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
                  <AlertIcon />
                  <div>
                    <p className="font-medium mb-1">QuadMart isn&apos;t at your school yet.</p>
                    <p className="text-xs text-amber-700">
                      Supported schools: {UNIVERSITIES.map(u => u.name).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
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

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" loading={loading} disabled={!matchedUniversity} className="w-full">
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>

            <p className="text-sm text-center text-text-secondary mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-primary-dark font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
