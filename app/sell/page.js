'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import Link from 'next/link'

const CATEGORIES = ['Product', 'Service', 'Sublease']
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']

export default function SellPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Product',
    condition: 'New',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    if (Number(form.price) < 0) {
      setError('Price cannot be negative.')
      return
    }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'listings'), {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category,
        condition: form.condition,
        sellerEmail: user.email,
        createdAt: serverTimestamp(),
      })
      router.push('/marketplace')
    } catch {
      setError('Failed to post listing. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#1a472a] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#1a472a] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/marketplace" className="text-white text-xl font-bold tracking-tight">
            QuadMart
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/messages" className="px-3 py-1.5 text-sm text-green-100 hover:text-white transition-colors">
              Messages
            </Link>
            <Link href="/settings" className="px-3 py-1.5 text-sm text-green-100 hover:text-white transition-colors">
              Settings
            </Link>
            <Link href="/marketplace" className="text-sm text-green-100 hover:text-white transition-colors">
              ← Marketplace
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Post a listing</h1>
          <p className="text-sm text-gray-500 mb-8">
            Fill in the details below to list your item or service.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Calculus textbook, Guitar lessons, 1BR sublease"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe what you're selling, condition, any details…"
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent resize-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent"
              />
            </div>

            {/* Category + Condition side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  name="condition"
                  value={form.condition}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent bg-white"
                >
                  {CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#1a472a] text-white font-medium rounded-lg hover:bg-[#145222] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {submitting ? 'Posting…' : 'Post Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
