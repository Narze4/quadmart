'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { marketApi } from '@/lib/market-api'

export default function SafetyActions({ targetUid, listingId, conversationId }) {
  const { user } = useAuth()
  const [block, setBlock] = useState(null)
  const [reportType, setReportType] = useState('')
  const [reason, setReason] = useState('scam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(null)
  useEffect(() => {
    if (!user || !targetUid || targetUid === user.uid) return
    let active = true
    marketApi('blockStatus', { targetUid }).then(result => { if (active) setBlock(result) }).catch(() => { if (active) setError('Safety controls could not load. Refresh to try again.') })
    return () => { active = false }
  }, [user, targetUid])
  if (!user || !targetUid || targetUid === user.uid) return null

  async function changeBlock() {
    setBusy(true); setError(''); setNotice('')
    try {
      await marketApi('block', { targetUid, blocked: !block.blockedByYou })
      setBlock(await marketApi('blockStatus', { targetUid }))
      setNotice(block.blockedByYou ? 'Your block was removed.' : 'User blocked. New messages and trades between you are prevented. Existing messages remain available as a record.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function submitReport(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const data = { targetType: reportType, targetId: reportType === 'listing' ? listingId : targetUid, reason, details, ...(conversationId ? { conversationId } : {}) }
    const signature = JSON.stringify(data)
    if (pending.current?.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() }
    try {
      const result = await marketApi('report', { ...data, requestId: pending.current.requestId })
      setReportType(''); setDetails(''); pending.current = null
      setNotice(result.alreadyOpen ? 'You already have an open report for this item. Track it in Safety center.' : 'Report received. You can track its status in Safety center. Your report is private to moderators.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section aria-label="Safety controls" className="border border-border rounded-xl p-4 space-y-3 text-sm">
    <div className="flex flex-wrap gap-3">
      {listingId && <button type="button" disabled={busy} className="underline" onClick={() => { setReportType('listing'); setNotice('') }}>Report listing</button>}
      <button type="button" disabled={busy} className="underline" onClick={() => { setReportType('user'); setNotice('') }}>Report user</button>
      <button type="button" disabled={busy || !block} className="underline text-red-700" onClick={changeBlock}>{block?.blockedByYou ? 'Unblock user' : 'Block user'}</button>
    </div>
    {block?.contactUnavailable && <p>Messaging and new trades between these accounts are unavailable.</p>}
    {notice && <p role="status" className="text-green-800">{notice}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {reportType && <form onSubmit={submitReport} className="space-y-3">
      <h3 className="font-semibold">Report {reportType === 'listing' ? 'listing' : 'user'}</h3>
      <label className="block">Reason<select className="input-field mt-1" value={reason} onChange={e => setReason(e.target.value)}>
        <option value="scam">Suspected scam</option><option value="harassment">Harassment</option><option value="inappropriate">Inappropriate content</option><option value="prohibited">Prohibited item</option><option value="spam">Spam</option><option value="other">Other</option>
      </select></label>
      <label className="block">What happened?<textarea required minLength={10} maxLength={2000} rows={4} className="input-field mt-1" value={details} onChange={e => setDetails(e.target.value)} /></label>
      <p className="text-text-secondary">Include enough detail to help us review it. Avoid passwords or sensitive personal information.{conversationId ? ' The last 10 messages in this conversation will be included for moderator review.' : ''}</p>
      <div className="flex gap-3"><button disabled={busy} className="px-4 py-2 rounded-lg bg-primary-dark text-white">{busy ? 'Submitting…' : 'Submit report'}</button><button type="button" disabled={busy} onClick={() => setReportType('')}>Cancel</button></div>
    </form>}
  </section>
}
