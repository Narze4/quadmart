'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function ProtectedPhoto({ src, alt, className = '', onError }) {
  const { user } = useAuth()
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    let active = true, objectUrl
    const controller = new AbortController()
    async function load() {
      try {
        if (!user || !/^\/api\/photos\/[a-f0-9]{64}$/.test(src)) throw new Error('Unavailable photo')
        const token = await user.getIdToken()
        const response = await fetch(src, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
        if (!response.ok) throw new Error('Unavailable photo')
        const blob = await response.blob()
        if (active) { objectUrl = URL.createObjectURL(blob); setPhoto({ src, url: objectUrl, uid: user.uid }) }
      } catch (error) { if (active && error.name !== 'AbortError') onError?.() }
    }
    load()
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [src, user, onError])
  if (!photo || photo.src !== src || photo.uid !== user?.uid) return <span role="img" aria-label={alt} className={`absolute inset-0 bg-gray-100 ${className}`} />
  // The bytes already passed through the authenticated image endpoint.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={alt} className={`absolute inset-0 w-full h-full ${className}`} />
}
