'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getToken, onTokenChanged } from 'firebase/app-check'
import { appCheck, auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'

export default function SessionCheck() {
  const { user, loading } = useAuth()
  if (loading) return <main className="p-6">Checking account…</main>
  if (!user?.emailVerified) return <main className="p-6"><Link href="/login">Sign in with a verified university account</Link></main>
  return <SignedInCheck key={user.uid} user={user} />
}

function SignedInCheck({ user }) {
  const [records, setRecords] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const run = useRef(null)
  useEffect(() => {
    if (!user?.emailVerified || !appCheck) return
    let active = true, sequence = 0
    async function check(result, source) {
      const current = ++sequence
      setBusy(true)
      try {
        const idToken = await user.getIdToken()
        if (!active || auth.currentUser !== user) return
        const response = await fetch('/api/development/session-check', {
          method: 'POST', cache: 'no-store',
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${idToken}`, 'X-Firebase-AppCheck': result.token },
        })
        const evidence = await response.json()
        if (!response.ok) throw Object.assign(Error('Session check failed.'), { status: response.status })
        if (active && current === sequence && auth.currentUser === user) {
          setRecords(previous => [...previous.slice(-7), { ...evidence, source }])
          setError('')
        }
      } catch (failure) {
        const status = Number.isInteger(failure?.status) ? ` (HTTP ${failure.status})` : ''
        if (active && current === sequence) setError(`Could not verify this session check${status}. Keep the page open and retry when connected.`)
      } finally { if (active && current === sequence) setBusy(false) }
    }
    const stop = onTokenChanged(appCheck, result => { void check(result, 'SDK callback') }, () => {
      if (active) setError('App Check renewal is temporarily unavailable. Keep the page open and retry when connected.')
    })
    run.current = async () => {
      setBusy(true)
      try {
        // Force only the user's Auth token exchange; App Check uses its normal
        // cached/on-demand policy. No App Check force-refresh or debug provider.
        await user.getIdToken(true)
        if (active && auth.currentUser === user) await check(await getToken(appCheck, false), 'Explicit Auth refresh')
      } catch { if (active) setError('Could not refresh sign-in. Keep this page open and retry when connected.') }
      finally { if (active) setBusy(false) }
    }
    return () => { active = false; run.current = null; stop() }
  }, [user])

  return <main className="mx-auto max-w-3xl p-6 space-y-5">
    <Link href="/dashboard" className="underline">Back to dashboard</Link>
    <h1 className="text-2xl font-bold">Development session check</h1>
    <p>Keep this page open to observe normal App Check renewal. Only server-verified times are displayed. This page does not save tokens or change their lifetime.</p>
    <label className="block">Unsaved test draft<textarea className="input-field mt-2" value={draft} onChange={event => setDraft(event.target.value)} /></label>
    <button className="min-h-11 rounded-lg bg-primary-dark px-4 py-2 text-white disabled:opacity-50" disabled={busy || !appCheck} onClick={() => run.current?.()}>Refresh sign-in and check</button>
    <p>This button refreshes Auth explicitly. App Check still follows its normal refresh policy; only a later issued-at time proves a new App Check token.</p>
    {!appCheck && <p role="alert">App Check is not available in this browser.</p>}
    {error && <p role="alert">{error} Your draft remains on this page.</p>}
    {records.length === 0 && !error && <p role="status">Waiting for verified App Check evidence…</p>}
    <ol className="space-y-4" aria-label="Verified session checks">{records.map((record, index) => <li key={`${record.checkedAt}-${index}`} className="rounded-lg border border-border p-4 space-y-1 break-words">
      <p className="font-semibold">{record.source} · {record.checkedAt}</p>
      <p>App Check issued: {record.appCheck.issuedAt}</p><p>App Check expires: {record.appCheck.expiresAt}</p>
      <p>Auth issued: {record.auth.issuedAt}</p><p>Auth expires: {record.auth.expiresAt}</p><p>Signed in: {record.auth.signedInAt}</p>
    </li>)}</ol>
  </main>
}
