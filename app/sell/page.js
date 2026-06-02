'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import Navbar from '@/components/Navbar'

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']

const CATEGORIES = [
  {
    value: 'Product',
    desc: 'Physical items to buy and sell',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    value: 'Service',
    desc: 'Skills and services to offer',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    value: 'Sublease',
    desc: 'Rooms and apartments to sublease',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
]

export default function SellPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [form, setForm] = useState({
    category: '',
    title: '',
    description: '',
    price: '',
    condition: 'New',
  })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const canNext = () => {
    if (step === 1) return !!form.category
    if (step === 2) return form.title.trim().length > 0
    if (step === 4) return form.price !== '' && Number(form.price) >= 0
    return true
  }

  const handleBack = () => {
    if (step === 1) router.back()
    else setStep(s => s - 1)
  }

  const handleNext = async () => {
    if (step < 6) { setStep(s => s + 1); return }
    setError('')
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
      router.push('/my-listings')
    } catch {
      setError('Failed to post listing. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files ?? [])
    const previews = files.map(f => URL.createObjectURL(f))
    setPhotoPreviews(previews)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={handleBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sell an item</h1>
            <p className="text-sm text-gray-500">Step {step} of 6</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-8">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="mb-8">
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">What are you listing?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => set('category', cat.value)}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      form.category === cat.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`mb-3 ${form.category === cat.value ? 'text-green-500' : 'text-gray-400'}`}>
                      {cat.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{cat.value}</h3>
                    <p className="text-xs text-gray-500">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">What&apos;s the title?</h2>
              <p className="text-sm text-gray-500 mb-6">Give your listing a clear, descriptive name.</p>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Calculus Textbook, Guitar Lessons, 1BR Sublease"
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Add a description</h2>
              <p className="text-sm text-gray-500 mb-6">Tell buyers more about what you&apos;re offering.</p>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe your item, its condition, what's included..."
                rows={6}
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Set your price</h2>
              <p className="text-sm text-gray-500 mb-6">Enter 0 for free items.</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">What&apos;s the condition?</h2>
              <p className="text-sm text-gray-500 mb-6">Be honest — buyers appreciate accurate descriptions.</p>
              <div className="grid grid-cols-2 gap-3">
                {CONDITIONS.map(cond => (
                  <button
                    key={cond}
                    onClick={() => set('condition', cond)}
                    className={`p-4 rounded-xl border-2 text-left font-medium text-sm transition-all ${
                      form.condition === cond
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Add photos</h2>
              <p className="text-sm text-gray-500 mb-6">Listings with photos get more attention. (Optional)</p>
              <label
                htmlFor="photos"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <svg className="w-10 h-10 text-gray-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="text-sm font-medium text-gray-500">Click to upload photos</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB each</p>
                <input id="photos" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
              </label>

              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {photoPreviews.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
            </div>
          )}
        </div>

        {/* Next / Post button */}
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            disabled={!canNext() || submitting}
            className="px-8 py-3 bg-green-500 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 6 ? (submitting ? 'Posting…' : 'Post Listing') : 'Next →'}
          </button>
        </div>
      </main>
    </div>
  )
}
