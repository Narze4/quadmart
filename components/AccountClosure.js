'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { finishAccountClosure } from '@/lib/account-closure'

export default function AccountClosure({ user }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    let active = true
    finishAccountClosure().then(() => router.replace('/account-closed')).catch(e => {
      if (active) { setError(e.message); setBusy(false) }
    })
    return () => { active = false }
  }, [user.uid, router])
  async function resume(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (password) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
        await user.getIdToken(true)
        setPassword('')
      }
      await finishAccountClosure()
      router.replace('/account-closed')
    } catch (e) {
      setError(e.code?.startsWith('auth/') ? 'Check your password or sign in again to continue deletion.' : e.message)
      setBusy(false)
    }
  }
  return <main className="mx-auto my-16 w-full max-w-lg px-6">
    <h1 className="text-2xl font-semibold mb-4">Your account is closed</h1>
    <p className="mb-4">Marketplace access has stopped. We are removing your listings, saved items and private profile before deleting your login.</p>
    <p className="text-sm text-text-secondary mb-6">Shared messages, trade history, reviews and moderation records are retained. Unused photos enter a separate cleanup queue; evidence photos are preserved.</p>
    {busy ? <p role="status">Finishing account deletion… Keep this tab open.</p> : <form onSubmit={resume} className="flex flex-col gap-3">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <label htmlFor="closure-password">Password, if a fresh sign-in is required</label>
      <input id="closure-password" type="password" autoComplete="current-password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="rounded-xl bg-red-600 text-white px-5 py-3" type="submit">Continue deletion</button>
      <button className="underline" type="button" onClick={() => signOut(auth)}>Sign out and finish later</button>
    </form>}
  </main>
}
