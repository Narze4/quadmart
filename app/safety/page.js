'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { marketApi } from '@/lib/market-api'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'

export default function SafetyPage() {
  const { user, loading } = useAuth()
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function refresh() { setError(''); try { setData(await marketApi('safetyOverview')) } catch(e) { setError(e.message) } }
  useEffect(() => { if(user?.emailVerified) { marketApi('safetyOverview').then(setData).catch(e=>setError(e.message)) } }, [user])
  async function unblock(targetUid) { setBusy(true); try { await marketApi('block',{targetUid,blocked:false}); await refresh() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  if(loading) return <main className="p-8">Loading…</main>
  if(!user?.emailVerified) return <main className="p-8"><Link href={user ? '/verify-email' : '/login'}>Sign in with a verified university email</Link></main>
  return <div className="min-h-screen flex flex-col"><AuthenticatedHeader/><main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-6">
    <h1 className="text-2xl font-bold">Safety center</h1><p>Manage blocked accounts and track your reports. Reports are private to moderators. Blocking prevents new messages and trades in both directions; existing messages remain as a record.</p>
    {error && <p role="alert">{error} <button className="underline" onClick={refresh}>Retry</button></p>}
    {!data && !error && <p>Loading safety settings…</p>}
    {data && <><section><h2 className="text-xl font-semibold mb-3">Blocked accounts</h2>{!data.blocks.length && <p>No blocked accounts.</p>}{data.blocks.map(block=><div key={block.id} className="flex justify-between items-center border rounded-xl p-4 mb-2"><span>{block.displayName || 'Student'}</span><button disabled={busy} onClick={()=>unblock(block.targetUid)} className="underline">Unblock {block.displayName || 'student'}</button></div>)}</section>
    <section><h2 className="text-xl font-semibold mb-3">Your reports</h2><p className="text-sm mb-3">Your 50 most recent reports.</p>{!data.reports.length && <p>No reports submitted.</p>}{data.reports.map(report=><article key={report.id} className="border rounded-xl p-4 mb-2"><h3 className="font-semibold [overflow-wrap:anywhere]">{report.targetLabel}</h3><p>{report.status === 'open' ? 'Awaiting review' : 'Reviewed'} · {new Date(report.createdAt).toLocaleDateString()}</p>{report.resolution && <p>Outcome: {({dismiss:'No action taken',removeListing:'Listing removed',suspend:'Account suspended',restoreListing:'Listing restored',reinstate:'Account reinstated'})[report.resolution]}</p>}</article>)}</section></>}
    <p className="text-sm">For help with an account restriction, <a className="underline" href="mailto:hello@quadmart.app">contact support</a>.</p>
  </main><Footer/></div>
}
