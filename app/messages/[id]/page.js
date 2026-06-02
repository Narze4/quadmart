'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import Link from 'next/link'

export default function ConversationPage() {
  const { user, loading, logout } = useAuth()
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
    const q = query(
      collection(db, 'conversations', id, 'messages'),
      orderBy('createdAt', 'asc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
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
    } finally {
      setSending(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const otherParticipant = conversation?.participants?.find((p) => p !== user?.email)

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#1a472a] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#1a472a] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/marketplace" className="text-white text-xl font-bold tracking-tight">
            QuadMart
          </Link>
          <div className="flex items-center gap-1 sm:gap-4">
            <Link href="/messages" className="px-3 py-1.5 text-sm text-white font-medium underline underline-offset-2">
              Messages
            </Link>
            <Link href="/sell" className="px-3 py-1.5 text-sm font-medium bg-white text-[#1a472a] rounded-lg hover:bg-gray-100 transition-colors">
              Sell
            </Link>
            <Link href="/settings" className="px-3 py-1.5 text-sm text-green-100 hover:text-white transition-colors">
              Settings
            </Link>
            <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-green-100 hover:text-white transition-colors">
              Log out
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 gap-4">
        {/* Conversation header */}
        <div className="flex items-center gap-3">
          <Link href="/messages" className="text-sm text-[#1a472a] hover:underline">
            ← Back
          </Link>
          <div>
            <p className="text-sm font-semibold text-gray-900">{otherParticipant}</p>
            {conversation?.listingTitle && (
              <p className="text-xs text-gray-500">Re: {conversation.listingTitle}</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[400px] max-h-[60vh] bg-white rounded-xl border border-gray-200 p-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-gray-400 my-auto">
              No messages yet. Say hello!
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderEmail === user.email
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-[#1a472a] text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply form */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a] focus:border-transparent bg-white"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="px-5 py-2.5 bg-[#1a472a] text-white text-sm font-medium rounded-full hover:bg-[#145222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
