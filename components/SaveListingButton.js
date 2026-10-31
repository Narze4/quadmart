'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function SaveListingButton(props) {
  const { user } = useAuth()
  return <SavedToggle key={`${user?.uid}:${props.listingId}`} {...props} />
}

function SavedToggle({ listingId, compact = false, removeOnly = false }) {
  const { savedListings, savedLoading, savedError, retrySaved, setListingSaved } = useAuth()
  const saved = removeOnly || savedListings.includes(listingId)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const save = async event => {
    event.preventDefault(); event.stopPropagation()
    if (pending) return
    if (savedError) { retrySaved(); setError('Reloading your saved items. Please try again once loaded.'); return }
    setPending(true); setError('')
    try { await setListingSaved(listingId, !saved) }
    catch (failure) { if (active.current) setError(failure.status === 429 || failure.message?.startsWith('You can save up to') ? failure.message : 'Could not update saved items. Please try again.') }
    finally { if (active.current) setPending(false) }
  }
  return <div className={compact ? 'absolute top-3 left-3 z-10' : 'space-y-2'}>
    <button type="button" onClick={save} disabled={pending || savedLoading} aria-busy={pending}
      aria-label={savedError ? 'Retry saved items' : saved ? 'Remove from saved' : 'Save listing'}
      className={compact ? 'w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow disabled:opacity-50' : 'w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-primary text-primary-dark font-semibold rounded-xl hover:bg-primary/10 disabled:opacity-50'}>
      <svg className={`w-4 h-4 ${saved ? 'fill-primary text-primary' : 'fill-none text-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
      {!compact && (pending ? 'Saving…' : savedError ? 'Retry saved items' : saved ? 'Remove from saved' : 'Save listing')}
    </button>
    {error && <p role="alert" className={compact ? 'absolute top-10 left-0 w-52 rounded-lg bg-white p-2 text-xs text-red-700 shadow' : 'text-sm text-red-700'}>{error}</p>}
  </div>
}
