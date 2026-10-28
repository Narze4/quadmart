'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { marketApi } from '@/lib/market-api'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import ProtectedPhoto from '@/components/ProtectedPhoto'
import Footer from '@/components/Footer'

function Report({ report, onResolved }) {
  const [note,setNote]=useState(''), [decision,setDecision]=useState('dismiss'), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const reversible = report.resolution === 'removeListing' ? 'restoreListing' : report.resolution === 'suspend' ? 'reinstate' : null
  async function submit(e) {
    e.preventDefault(); setBusy(true);setError('')
    try { await marketApi('moderate',{reportId:report.id,version:report.version??0,decision:report.status==='open'?decision:reversible,note}); await onResolved() } catch(e) { setError(e.message) } finally { setBusy(false) }
  }
  return <article className="border border-border bg-surface rounded-xl p-5 space-y-3">
    <h2 className="text-lg font-semibold">{report.targetLabel}</h2><p className="text-sm">{report.targetType} · {report.reason} · {new Date(report.createdAt).toLocaleString()}</p>
    <p className="whitespace-pre-wrap">{report.details}</p>
    <details><summary className="cursor-pointer underline">Evidence and report details</summary><div className="mt-3 space-y-2 text-sm break-words">
      <p>Report ID: {report.id}</p><p>Reporter ID: {report.reporterUid}</p><p>Subject ID: {report.targetUid}</p>
      {report.snapshot?.description && <p>Listing at report time: {report.snapshot.description}</p>}
      {report.snapshot?.imageIds?.length > 0 && <div className="flex flex-wrap gap-3">{report.snapshot.imageIds.map(id=><div key={id} className="relative w-40 h-40"><ProtectedPhoto src={`/api/photos/${id}`} alt="Reported listing photo" className="object-contain"/></div>)}</div>}
      {report.evidence?.length > 0 && <><h3 className="font-semibold">Recent conversation messages</h3>{report.evidence.map(message=><p key={message.id}><strong>{message.senderUid===report.reporterUid?'Reporter':'Subject'}:</strong> {message.text}</p>)}</>}
    </div></details>
    {report.status==='resolved' && <p>Decision: {report.resolution}. Moderator note: {report.note}</p>}
    {(report.status==='open'||reversible) && <form onSubmit={submit} className="space-y-3 border-t pt-3">
      {report.status==='open' ? <label className="block">Decision<select className="input-field mt-1" value={decision} onChange={e=>setDecision(e.target.value)}><option value="dismiss">Close without action</option>{report.targetType==='listing'&&<option value="removeListing">Remove listing</option>}<option value="suspend">Suspend account</option></select></label> : <p>{reversible==='restoreListing'?'Restore the archived listing':'Reinstate this account'} after reviewing the decision.</p>}
      <p className="text-sm text-text-secondary">Removal hides the listing and its photos, preserving a private copy. Suspension stops account access and new activity; review existing listings separately.</p>
      <label className="block">Moderator note<textarea required minLength={10} maxLength={1000} rows={2} value={note} onChange={e=>setNote(e.target.value)} className="input-field mt-1"/></label>
      <button disabled={busy} className="bg-primary-dark text-white rounded-lg px-4 py-2">{busy?'Applying…':report.status==='open'?'Apply decision':reversible==='restoreListing'?'Restore listing':'Reinstate account'}</button>
    </form>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
  </article>
}
export default function ModerationPage() {
  const {user,loading}=useAuth()
  const [data,setData]=useState(null), [status,setStatus]=useState('open'), [error,setError]=useState(''), [busy,setBusy]=useState(false)
  async function refresh() { setError('');try {setData(await marketApi('moderationQueue',{status}))}catch(e){setError(e.message)} }
  useEffect(()=>{let active=true;if(user?.emailVerified)marketApi('moderationQueue',{status}).then(d=>{if(active){setData(d);setError('')}}).catch(e=>{if(active){setData(null);setError(e.message)}});return()=>{active=false}},[user,status])
  async function more(){setBusy(true);try{const next=await marketApi('moderationQueue',{status,cursor:data.nextCursor});setData(old=>({reports:[...old.reports,...next.reports],nextCursor:next.nextCursor}))}catch(e){setError(e.message)}finally{setBusy(false)}}
  if(loading) return <main className="p-8">Loading…</main>
  if(!user?.emailVerified) return <main className="p-8"><Link href={user?'/verify-email':'/login'}>Sign in with a verified university email</Link></main>
  return <div className="min-h-screen flex flex-col"><AuthenticatedHeader/><main className="max-w-3xl w-full mx-auto p-6 flex-1 space-y-5">
    <h1 className="text-2xl font-bold">Moderation</h1><p>Private reports for your campus. Record a reason for each decision; changes are logged and can be reviewed.</p>
    <div className="flex gap-4"><button disabled={status==='open'} onClick={()=>{setData(null);setStatus('open')}} aria-pressed={status==='open'} className="underline">Open reports</button><button disabled={status==='resolved'} onClick={()=>{setData(null);setStatus('resolved')}} aria-pressed={status==='resolved'} className="underline">Resolved reports</button><button onClick={refresh} className="underline">Refresh</button></div>
    {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Loading reports…</p>}{data?.reports.length===0&&<p>No {status} reports.</p>}
    {data?.reports.map(report=><Report key={`${report.id}-${report.version??0}`} report={report} onResolved={refresh}/>)}
    {data?.nextCursor&&<button disabled={busy} onClick={more} className="underline">Load more reports</button>}
  </main><Footer/></div>
}
