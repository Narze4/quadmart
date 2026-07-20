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

const UNIVERSITIES = [
  { name: 'Emory University', city: 'Atlanta, GA', domain: 'emory.edu' },
  { name: 'University of Georgia', city: 'Athens, GA', domain: 'uga.edu' },
  { name: 'Georgia Institute of Technology', city: 'Atlanta, GA', domain: 'gatech.edu' },
  { name: 'SCAD University', city: 'Savannah, GA', domain: 'scad.edu' },
  { name: 'Georgia State University', city: 'Atlanta, GA', domain: 'gsu.edu' },
  { name: 'Kennesaw State University', city: 'Kennesaw, GA', domain: 'ksu.edu' },
  { name: 'University of Tennessee', city: 'Knoxville, TN', domain: 'utk.edu' },
]

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

const GradCapIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
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
  const [step, setStep] = useState(1)
  const [selectedUniversity, setSelectedUniversity] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleNext = () => {
    if (selectedUniversity) setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.endsWith('.edu')) {
      setError('Only .edu email addresses are allowed. Please use your university email.')
      return
    }

    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        university: selectedUniversity.name,
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

  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <PublicHeader />

        <div className="flex-1 px-4 py-12 max-w-5xl mx-auto w-full">
          <p className="text-sm text-text-secondary text-center mb-6">Step 1 of 2</p>

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-text-primary mb-1">Select your university</h1>
            <p className="text-sm text-text-secondary">You&apos;ll only see listings from students at your school.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {UNIVERSITIES.map((uni) => {
              const selected = selectedUniversity?.name === uni.name
              return (
                <button
                  key={uni.name}
                  onClick={() => setSelectedUniversity(uni)}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    selected
                      ? 'ring-2 ring-primary ring-offset-2 border-transparent bg-primary/10'
                      : 'border-border bg-surface hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-dark flex items-center justify-center text-white">
                      <CheckIcon />
                    </span>
                  )}
                  <div className={`mb-3 ${selected ? 'text-primary-dark' : 'text-gray-400'}`}>
                    <GradCapIcon />
                  </div>
                  <h3 className="font-semibold text-text-primary text-base leading-snug mb-0.5">{uni.name}</h3>
                  <p className="text-sm text-text-secondary">{uni.city}</p>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleNext} disabled={!selectedUniversity} size="lg">
              Next →
            </Button>
          </div>
        </div>

        <Footer />
      </div>
    )
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
              Almost there, {selectedUniversity?.name?.split(' ')[0]}.
            </h2>
            <p className="text-green-100 mb-8">
              One more step and you&apos;ll be browsing what your campus has to offer.
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
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              {selectedUniversity?.name}
            </button>

            <h1 className="text-3xl font-bold text-text-primary mb-1">Create your account</h1>
            <p className="text-sm text-text-secondary mb-8">
              Use your <span className="font-medium text-text-primary">{selectedUniversity?.domain}</span> email to verify your student status.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">University Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${selectedUniversity?.domain}`}
                  required
                  autoFocus
                  className="input-field"
                />
              </div>

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

              <Button type="submit" variant="primary" loading={loading} className="w-full">
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
