'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onIdTokenChanged, signOut } from 'firebase/auth'
import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { marketApi } from './market-api'
import { auth, db } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [savedListings, setSavedListings] = useState([])

  useEffect(() => {
    let active = true
    let generation = 0
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      const current = ++generation
      setLoading(true)
      try {
        if (firebaseUser?.emailVerified) await marketApi('profile')
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
    })
    return () => {
      unsub()
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

  if (setupError) return <main className="p-8"><p role="alert">{setupError}</p><button onClick={() => auth.currentUser?.getIdToken(true)}>Retry account setup</button><button onClick={logout}>Log out</button></main>

  return (
    <AuthContext.Provider value={{ user, loading, logout, savedListings, toggleSaved }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
