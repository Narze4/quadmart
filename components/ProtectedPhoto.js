'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function ProtectedPhoto({ src, alt, className = '', onError }) {
  const { user } = useAuth()
  const [photo, setPhoto] = useState(null)
  const [failure, setFailure] = useState(null)
  const [retry, setRetry] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const errorCallback = useRef(onError)
  useEffect(() => { errorCallback.current = onError }, [onError])
  useEffect(() => {
    let active = true, objectUrl, timer
    const controller = new AbortController()
    async function load() {
      try {
        if (!user || !/^\/api\/photos\/[a-f0-9]{64}$/.test(src)) throw new Error('Unavailable photo')
        const token = await user.getIdToken()
        const response = await fetch(src, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
        if (response.status === 429) {
          const seconds = Number(response.headers.get('retry-after'))
          const delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 60
          if (active) {
            setFailure({ src, uid: user.uid, message: 'Photo viewing limit reached. Please wait before retrying.' })
            setWaiting(true)
            timer = setTimeout(() => { if (active) setWaiting(false) }, delay * 1000)
          }
          return
        }
        if (!response.ok) throw new Error('Unavailable photo')
        const blob = await response.blob()
        if (active) { objectUrl = URL.createObjectURL(blob); setPhoto({ src, url: objectUrl, uid: user.uid }); setFailure(null) }
      } catch (error) { if (active && error.name !== 'AbortError') { setFailure({ src, uid: user?.uid, message: 'Photo unavailable. Please try again.' }); setWaiting(false); if (retry === 0) errorCallback.current?.() } }
    }
    load()
    return () => { active = false; controller.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [src, user, retry])
  if (failure?.src === src && failure.uid === user?.uid) return <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 p-3 text-center text-xs text-text-secondary">
    <span>{failure.message}</span><button type="button" disabled={waiting} onClick={e => { e.preventDefault(); e.stopPropagation(); setWaiting(true); setRetry(k => k + 1) }} className="min-h-11 rounded-lg border border-border bg-white px-3 disabled:opacity-50">{waiting ? 'Please wait…' : 'Retry photo'}</button>
  </div>
  if (!photo || photo.src !== src || photo.uid !== user?.uid) return <span role="img" aria-label={alt} className={`absolute inset-0 bg-gray-100 ${className}`} />
  // The bytes already passed through the authenticated image endpoint.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={alt} className={`absolute inset-0 w-full h-full ${className}`} />
}
