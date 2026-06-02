'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-green-500 font-bold text-xl">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            QuadMart
          </Link>
          <p className="text-sm text-gray-500">Step {step} of 2</p>
        </div>
      </nav>

      <div className="flex-1 px-4 py-10 max-w-4xl mx-auto w-full">
        {step === 1 ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Select your university</h1>
              <p className="text-sm text-gray-500">You&apos;ll only see listings from students at your school.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {UNIVERSITIES.map((uni) => {
                const selected = selectedUniversity?.name === uni.name
                return (
                  <button
                    key={uni.name}
                    onClick={() => setSelectedUniversity(uni)}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
                        <CheckIcon />
                      </span>
                    )}
                    <div className={`mb-3 ${selected ? 'text-green-500' : 'text-gray-400'}`}>
                      <GradCapIcon />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-0.5">{uni.name}</h3>
                    <p className="text-xs text-gray-500">{uni.city}</p>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleNext}
                disabled={!selectedUniversity}
                className="px-8 py-3 bg-green-500 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              {selectedUniversity?.name}
            </button>

            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-sm text-gray-500 mb-8">
              Use your <span className="font-medium text-gray-700">{selectedUniversity?.domain}</span> email to verify your student status.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">University Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${selectedUniversity?.domain}`}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p className="text-sm text-center text-gray-500 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-green-600 font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
