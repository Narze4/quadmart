'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { marketApi } from '@/lib/market-api'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import Footer from '@/components/Footer'

export default function ConversationPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const pending = useRef(null)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    else if (!loading && user && !user.emailVerified) router.replace('/verify-email')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !id) return
    getDoc(doc(db, 'conversations', id)).then((snap) => {
      if (snap.exists()) setConversation({ id: snap.id, ...snap.data() })
      else router.replace('/messages')
    })
  }, [user, id, router])

  useEffect(() => {
    if (!user || !id) return
    const q = query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'desc'), limit(100))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse())
      },
      (err) => console.error('messages listener error:', err)
    )
    return unsubscribe
  }, [user, id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      setSendError('')
      if (!pending.current || pending.current.text !== trimmed) pending.current = { text: trimmed, requestId: crypto.randomUUID() }
      await marketApi('message', { conversationId: id, ...pending.current })
      pending.current = null
      setText('')
    } catch (error) { setSendError(error.message)
    } finally {
      setSending(false)
    }
  }

  const otherIdx = conversation?.participants?.findIndex((p) => p !== user?.uid) ?? -1
  const otherParticipantEmail = otherIdx > -1 ? conversation.participantNames?.[otherIdx] : null

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

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/messages" className="text-sm text-primary-dark hover:underline">← Back</Link>
          <div>
            <p className="text-sm font-semibold text-text-primary">{otherParticipantEmail ?? 'Unknown'}</p>
            {conversation?.listingTitle && (
              <p className="text-xs text-text-secondary">Re: {conversation.listingTitle}</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[400px] max-h-[60vh] bg-surface rounded-2xl border border-border shadow-sm p-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-text-secondary my-auto">No messages yet. Say hello!</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderUid === user.uid
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                  isMe ? 'bg-primary-dark text-white rounded-br-sm' : 'bg-gray-100 text-text-primary rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {sendError && <p role="alert">{sendError}</p>}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="input-field flex-1 rounded-full"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="px-5 py-2.5 bg-primary-dark text-white text-sm font-medium rounded-full hover:bg-primary-dark-hover transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>

      <Footer />
    </div>
  )
}
