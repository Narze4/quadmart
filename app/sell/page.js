'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { marketApi } from '@/lib/market-api'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'

const TOTAL_STEPS = 6
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
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadsAvailable, setUploadsAvailable] = useState(false)
  const [error, setError] = useState('')
  const pendingListing = useRef(null)
  const uploadCache = useRef(new WeakMap())
  const photoPreviews = useRef(new Set())
  useEffect(() => () => { photoPreviews.current.forEach(url => URL.revokeObjectURL(url)) }, [])
  const [photos, setPhotos] = useState([]) // [{ file: File, preview: string }]
  const [form, setForm] = useState({
    category: '',
    title: '',
    description: '',
    price: '',
    condition: 'New',
  })

  useEffect(() => {
    let active = true
    fetch('/api/upload').then(response => response.json()).then(data => {
      if (active) setUploadsAvailable(data.enabled === true)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const canNext = () => {
    if (step === 1) return !!form.category
    if (step === 2) return true // photos optional
    if (step === 3) return form.title.trim().length > 0
    if (step === 5) return form.price !== '' && Number(form.price) >= 0
    return true
  }

  const handleBack = () => {
    if (step === 1) router.back()
    else setStep(s => s - 1)
  }

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (photos.length + files.length > 5) { setError('Choose up to 5 photos.'); return }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024 || file.size === 0)) {
      setError('Choose JPG, PNG, or WebP photos, up to 3 MB each.'); return
    }
    setError('')
    const selected = files.map(file => {
      const preview = URL.createObjectURL(file)
      photoPreviews.current.add(preview)
      return { file, preview }
    })
    setPhotos(prev => [...prev, ...selected])
  }

  const removePhoto = (index) => {
    const preview = photos[index].preview
    URL.revokeObjectURL(preview)
    photoPreviews.current.delete(preview)
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setError('')
  }

  const uploadImages = async () => {
    const assets = []
    for (const [index, { file }] of photos.entries()) {
      let cached = uploadCache.current.get(file)
      if (!cached) { cached = { requestId: crypto.randomUUID() }; uploadCache.current.set(file, cached) }
      if (!cached.asset) {
        setUploadProgress(`Uploading photo ${index + 1} of ${photos.length}…`)
        const token = await user.getIdToken()
        const res = await fetch('/api/upload', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'X-Upload-Id': cached.requestId }, body: file,
        })
        let data
        try { data = await res.json() } catch { throw new Error('Photo upload is temporarily unavailable. Please retry.') }
        if (!res.ok) throw new Error(data.error ?? 'Photo upload failed. Please retry.')
        cached.asset = data
      }
      assets.push(cached.asset)
    }
    setUploadProgress('')
    return assets
  }

  const handleNext = async () => {
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }
    setError('')
    setSubmitting(true)
    try {
      let assets
      try { assets = await uploadImages() }
      catch (uploadError) { setStep(2); throw uploadError }
      const data = {
        title: form.title.trim(), description: form.description.trim(),
        price: Number(form.price), category: form.category, condition: form.condition,
        imageIds: assets.map(asset => asset.id),
      }
      const signature = JSON.stringify(data)
      if (pendingListing.current?.signature !== signature) pendingListing.current = { signature, requestId: crypto.randomUUID() }
      await marketApi('listingCreate', { ...data, requestId: pendingListing.current.requestId })
      router.push('/my-listings')
    } catch (error) {
      setError(error.message || 'Failed to post listing. Please try again.')
    } finally {
      setSubmitting(false)
      setUploadProgress('')
    }
  }

  if (loading || !user || !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 w-full">
        {/* Step header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={handleBack} aria-label="Back" disabled={submitting} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-text-secondary">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Sell an item</h1>
            <p className="text-sm text-text-secondary">Step {step} of {TOTAL_STEPS}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="mb-8" key={step}>
          <div className="animate-fade-in">

          {/* Step 1: Category */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-6">What are you listing?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => set('category', cat.value)}
                    className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                      form.category === cat.value
                        ? 'ring-2 ring-primary ring-offset-2 border-transparent bg-primary/10'
                        : 'border-border bg-surface hover:border-gray-300'
                    }`}
                  >
                    <div className={`mb-3 ${form.category === cat.value ? 'text-primary-dark' : 'text-gray-400'}`}>
                      {cat.icon}
                    </div>
                    <h3 className="font-semibold text-text-primary mb-1">{cat.value}</h3>
                    <p className="text-xs text-text-secondary">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Photos */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Add photos</h2>
              <p className="text-sm text-text-secondary mb-6">
                Listings with photos get more attention. Up to 5 images. (Optional)
              </p>

              {!uploadsAvailable && <p className="text-sm text-text-secondary">Photos are temporarily unavailable. You can continue and publish without photos.</p>}
              {uploadsAvailable && photos.length < 5 && (
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center w-full h-52 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <svg className="w-12 h-12 text-gray-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <p className="text-sm font-medium text-text-secondary">Upload photos</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {photos.length === 0 ? 'JPG, PNG, or WebP up to 3 MB each' : `${photos.length}/5 added — click to add more`}
                  </p>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}

              {photos.length > 0 && (
                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${photos.length < 5 ? 'mt-4' : ''}`}>
                  {photos.map((photo, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.preview}
                        alt=""
                        className="w-full h-32 object-cover rounded-xl border border-border"
                      />
                      <button
                        onClick={() => removePhoto(i)}
                        aria-label={`Remove photo ${i + 1}`}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-900/70 text-white flex items-center justify-center hover:bg-gray-900 focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {/* Add more slot when grid has room */}
                  {photos.length < 5 && (
                    <label
                      htmlFor="photo-upload"
                      className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Title */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">What&apos;s the title?</h2>
              <p className="text-sm text-text-secondary mb-6">Give your listing a clear, descriptive name.</p>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Calculus Textbook, Guitar Lessons, 1BR Sublease"
                autoFocus
                className="input-field"
              />
            </div>
          )}

          {/* Step 4: Description */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Add a description</h2>
              <p className="text-sm text-text-secondary mb-6">Tell buyers more about what you&apos;re offering.</p>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe your item, its condition, what's included..."
                rows={6}
                autoFocus
                className="input-field resize-none"
              />
            </div>
          )}

          {/* Step 5: Price */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Set your price</h2>
              <p className="text-sm text-text-secondary mb-6">Enter 0 for free items.</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-medium">$</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="input-field pl-8"
                />
              </div>
            </div>
          )}

          {/* Step 6: Condition */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">What&apos;s the condition?</h2>
              <p className="text-sm text-text-secondary mb-6">Be honest — buyers appreciate accurate descriptions.</p>
              <div className="grid grid-cols-2 gap-3">
                {CONDITIONS.map(cond => (
                  <button
                    key={cond}
                    onClick={() => set('condition', cond)}
                    className={`p-4 rounded-xl border-2 text-left font-medium text-sm transition-all duration-200 ${
                      form.condition === cond
                        ? 'ring-2 ring-primary ring-offset-2 border-transparent bg-primary/10 text-primary-dark'
                        : 'border-border bg-surface text-text-primary hover:border-gray-300'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>

            </div>
          )}
          </div>
          {error && <p role="alert" className="text-sm text-red-600 mt-6">{error}</p>}
        </div>

        {/* Next / Post button */}
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            disabled={!canNext() || submitting}
            className="px-8 py-3 bg-primary-dark hover:bg-primary-dark-hover text-white font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px]"
          >
            {step === TOTAL_STEPS
              ? submitting
                ? (uploadProgress || 'Posting…')
                : 'Post Listing'
              : 'Next →'}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
