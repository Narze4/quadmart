'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
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

export default function SignUpPage() {
  const [step, setStep] = useState(1)
  const [selectedUniversity, setSelectedUniversity] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      router.push('/dashboard')
    } catch (err) {
      setError(FIREBASE_ERRORS[err.code] ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicHeader />

      <div className="flex-1 px-4 py-12 max-w-4xl mx-auto w-full">
        <p className="text-sm text-text-secondary text-center mb-6">Step {step} of 2</p>

        {step === 1 ? (
          <>
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
                    className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                      selected
                        ? 'ring-2 ring-primary ring-offset-2 border-transparent bg-primary/10'
                        : 'border-border bg-surface hover:border-gray-300'
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
                    <h3 className="font-semibold text-text-primary text-sm leading-snug mb-0.5">{uni.name}</h3>
                    <p className="text-xs text-text-secondary">{uni.city}</p>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNext} disabled={!selectedUniversity} size="lg">
                Next →
              </Button>
            </div>
          </>
        ) : (
          <div className="max-w-md mx-auto">
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
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="input-field"
                />
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
        )}
      </div>

      <Footer />
    </div>
  )
}
