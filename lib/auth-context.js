'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savedListings, setSavedListings] = useState([])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) return
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

  return (
    <AuthContext.Provider value={{ user, loading, logout, savedListings, toggleSaved }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
