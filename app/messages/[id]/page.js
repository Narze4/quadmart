'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { createNotification } from '@/lib/notifications'
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

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
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
    const q = query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
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
      await addDoc(collection(db, 'conversations', id, 'messages'), {
        text: trimmed,
        senderEmail: user.email,
        createdAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'conversations', id), {
        lastMessage: trimmed,
        lastMessageAt: serverTimestamp(),
      })
      setText('')

      // Notify the recipient
      if (otherParticipant) {
        const recipientSnap = await getDocs(query(collection(db, 'users'), where('email', '==', otherParticipant)))
        if (!recipientSnap.empty) {
          const recipientUid = recipientSnap.docs[0].id
          await createNotification(
            recipientUid,
            'message',
            `New message from ${user.email.split('@')[0]}`,
            trimmed.slice(0, 50),
            `/messages/${id}`
          )
        }
      }
    } finally {
      setSending(false)
    }
  }

  const otherParticipant = conversation?.participants?.find((p) => p !== user?.email)

  if (loading || !user) {
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
            <p className="text-sm font-semibold text-text-primary">{otherParticipant}</p>
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
            const isMe = msg.senderEmail === user.email
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
