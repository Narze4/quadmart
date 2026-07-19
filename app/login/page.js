'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PublicHeader from '@/components/PublicHeader'
import Footer from '@/components/Footer'
import Button from '@/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicHeader />

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
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
              <label className="block text-sm font-medium text-text-primary mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="input-field"
              />
            </div>

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

      <Footer />
    </div>
  )
}
