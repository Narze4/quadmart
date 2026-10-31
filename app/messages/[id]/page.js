'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { marketApi } from '@/lib/market-api'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { messageFeed } from '@/lib/feed-queries.mjs'
import { useCursorFeed } from '@/lib/use-cursor-feed'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import SafetyActions from '@/components/SafetyActions'
import Footer from '@/components/Footer'

export default function ConversationPage() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  return <Conversation key={`${user?.uid ?? ''}:${id}`} user={user} loading={loading} id={id} />
}

function Conversation({ user, loading, id }) {
  const router = useRouter()
  const [conversation, setConversation] = useState(null)
  const [conversationError, setConversationError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const pending = useRef(null)
  const [sendError, setSendError] = useState('')
  const scrollRef = useRef(null)
  const scrollBefore = useRef(null)
  const newest = useRef(null)
  const following = useRef(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  useEffect(() => {
    if (!user?.emailVerified || !id) return
    return onSnapshot(doc(db, 'conversations', id), snap => {
      if (snap.exists()) { setConversation({ ...snap.data(), id: snap.id }); setConversationError('') }
      else { setConversation(null); setConversationError('This conversation is unavailable.') }
    }, () => { setConversation(null); setConversationError('This conversation is unavailable. Try again or return to Messages.') })
  }, [user?.uid, user?.emailVerified, id, retryKey])

  const configuration = useMemo(() => ({ ...messageFeed(db, id), enabled: !!user?.emailVerified, retryKey }), [id, user?.emailVerified, retryKey])
  const feed = useCursorFeed(configuration)
  const messages = [...feed.items].reverse()
  const newestId = feed.items[0]?.id
  useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return
    if (scrollBefore.current && !feed.loadingMore) {
      const before = scrollBefore.current
      node.scrollTop = before.top + node.scrollHeight - before.height
      scrollBefore.current = null
    } else if (newestId !== newest.current && following.current) node.scrollTop = node.scrollHeight
    newest.current = newestId
  }, [feed.items, feed.loadingMore, newestId])

  const loadOlder = () => {
    const node = scrollRef.current
    if (node) scrollBefore.current = { top: node.scrollTop, height: node.scrollHeight }
    feed.loadMore()
  }
  const handleSend = async e => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending || !conversation || feed.denied) return
    setSending(true)
    try {
      setSendError('')
      if (!pending.current || pending.current.text !== trimmed) pending.current = { text: trimmed, requestId: crypto.randomUUID() }
      following.current = true
      await marketApi('message', { conversationId: id, ...pending.current })
      pending.current = null
      setText('')
    } catch (error) { setSendError(error.message) }
    finally { setSending(false) }
  }
  const otherIdx = conversation?.participants?.findIndex(p => p !== user?.uid) ?? -1
  const name = otherIdx > -1 ? conversation.participantNames?.[otherIdx] : null
  if (loading || !user || !user.emailVerified) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AuthenticatedHeader />
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/messages" className="text-sm text-primary-dark hover:underline">← Back</Link>
          <div className="min-w-0 [overflow-wrap:anywhere]"><p className="text-sm font-semibold text-text-primary">{name ?? 'Conversation'}</p>{conversation?.listingTitle && <p className="text-xs text-text-secondary">Re: {conversation.listingTitle}</p>}</div>
        </div>
        {conversationError && <p role="alert" className="text-sm text-red-700">{conversationError}</p>}
        <div ref={scrollRef} onScroll={e => { const n = e.currentTarget; following.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80 }} className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-40 h-[40dvh] max-h-[32rem] bg-surface rounded-2xl border border-border shadow-sm p-4">
          {feed.historyReset && <p className="text-sm text-text-secondary">New activity refreshed this conversation. Load older messages again to continue.</p>}
          {!feed.loading && feed.hasMore && !feed.denied && <button type="button" onClick={loadOlder} disabled={feed.loadingMore} className="text-sm text-primary-dark hover:underline disabled:opacity-50">{feed.loadingMore ? 'Loading…' : 'Load older messages'}</button>}
          {feed.loading && <p role="status" className="text-center text-sm text-text-secondary">Loading messages…</p>}
          {feed.error && <p role="alert" className="text-sm text-red-700">{feed.error}</p>}
          {(feed.error || conversationError) && <button type="button" onClick={() => setRetryKey(k => k + 1)} className="text-sm text-primary-dark hover:underline">Retry messages</button>}
          {!feed.loading && !feed.error && !conversationError && messages.length === 0 && <p className="text-center text-sm text-text-secondary my-auto">No messages yet. Say hello!</p>}
          {messages.map(msg => <div key={msg.id} className={`flex ${msg.senderUid === user.uid ? 'justify-end' : 'justify-start'}`}><div className={`min-w-0 max-w-[85%] sm:max-w-sm [overflow-wrap:anywhere] px-4 py-2.5 rounded-2xl text-sm ${msg.senderUid === user.uid ? 'bg-primary-dark text-white rounded-br-sm' : 'bg-gray-100 text-text-primary rounded-bl-sm'}`}>{msg.text}</div></div>)}
        </div>
        <SafetyActions targetUid={otherIdx > -1 ? conversation.participants[otherIdx] : null} conversationId={id} />
        {sendError && <p role="alert">{sendError}</p>}
        <form onSubmit={handleSend} className="sticky bottom-0 flex gap-2 bg-bg py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" maxLength={4000} aria-label="Message" className="input-field min-w-0 flex-1 rounded-full" />
          <button type="submit" disabled={!text.trim() || sending || !conversation || feed.denied} className="px-5 py-2.5 bg-primary-dark text-white text-sm font-medium rounded-full hover:bg-primary-dark-hover transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Send</button>
        </form>
      </div>
      <Footer />
    </div>
  )
}
