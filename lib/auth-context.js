'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onIdTokenChanged, signOut } from 'firebase/auth'
import { arrayRemove, arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import AccountClosure from '@/components/AccountClosure'
import { marketApi } from './market-api'
import { auth, db } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [closedUser, setClosedUser] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [isModerator, setIsModerator] = useState(false)
  const [savedListings, setSavedListings] = useState([])

  useEffect(() => {
    let active = true
    let generation = 0
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      const current = ++generation
      setLoading(true)
      try {
        const lifecycle = firebaseUser ? await getDoc(doc(db, 'accountLifecycle', firebaseUser.uid)) : null
        if (lifecycle?.data()?.closed) {
          if (active && current === generation) { setClosedUser(firebaseUser); setUser(null); setSetupError('') }
          return
        }
        if (active && current === generation) setClosedUser(null)
        let safety = null
        if (firebaseUser?.emailVerified) { await marketApi('profile'); safety = await marketApi('safetyStatus') }
        if (active && current === generation) setIsModerator(safety?.isModerator === true)
        if (active && current === generation) { setUser(firebaseUser); setSetupError('') }
      } catch (error) {
        if (active && current === generation) { setUser(null); setSetupError(error.message) }
      } finally { if (active && current === generation) setLoading(false) }
    })
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    if (!user?.emailVerified) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      setSavedListings(snap.data()?.savedListings ?? [])
    }, () => setSavedListings([]))
    const stopLifecycle = onSnapshot(doc(db, 'accountLifecycle', user.uid), snap => {
      if (snap.data()?.closed) setClosedUser(user)
    }, () => {})
    const stopAccount = onSnapshot(doc(db, 'moderationAccounts', user.uid), snap => {
      if (snap.data()?.suspended === true) setSetupError('Your account is suspended. Contact hello@quadmart.app for a review.')
      else setSetupError('')
    }, () => setSetupError('Account access could not be checked. Retry account setup.'))
    return () => {
      unsub()
      stopAccount()
      stopLifecycle()
      setSavedListings([])
    }
  }, [user])

  const logout = () => signOut(auth)

  const toggleSaved = async (listingId) => {
    if (!user) return
    const isSaved = savedListings.includes(listingId)
    await updateDoc(doc(db, 'users', user.uid), {
      savedListings: isSaved ? arrayRemove(listingId) : arrayUnion(listingId),
    })
  }

  if (closedUser) return <AccountClosure user={closedUser} />

  if (setupError) return <main className="p-8"><p role="alert">{setupError}</p><button onClick={() => auth.currentUser?.getIdToken(true)}>Retry account setup</button><button onClick={logout}>Log out</button></main>

  return (
    <AuthContext.Provider value={{ user, loading, logout, savedListings, toggleSaved, isModerator }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
