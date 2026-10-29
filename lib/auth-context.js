'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onIdTokenChanged, signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import AccountClosure from '@/components/AccountClosure'
import { marketApi } from './market-api'
import { auth, db } from './firebase'
import { savedItemIds, writeSavedItem, MAX_SAVED_ITEMS } from './saved-items.mjs'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [closedUser, setClosedUser] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [isModerator, setIsModerator] = useState(false)
  const [savedState, setSavedState] = useState(null)
  const [savedRetry, setSavedRetry] = useState(0)
  const scopedSaved = savedState?.uid === user?.uid ? savedState : null
  const savedListings = scopedSaved?.ids ?? []
  const savedLoading = !!user?.emailVerified && !scopedSaved
  const savedError = scopedSaved?.error ?? ''
  const retrySaved = () => { setSavedState(null); setSavedRetry(value => value + 1) }

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
    const stopLifecycle = onSnapshot(doc(db, 'accountLifecycle', user.uid), snap => {
      if (snap.data()?.closed) setClosedUser(user)
    }, () => {})
    const stopAccount = onSnapshot(doc(db, 'moderationAccounts', user.uid), snap => {
      if (snap.data()?.suspended === true) setSetupError('Your account is suspended. Contact hello@quadmart.app for a review.')
      else setSetupError('')
    }, () => setSetupError('Account access could not be checked. Retry account setup.'))
    return () => {
      stopAccount()
      stopLifecycle()
    }
  }, [user])

  useEffect(() => {
    if (!user?.emailVerified) return
    const uid = user.uid
    let active = true
    const failed = () => { if (active) setSavedState({ uid, ids: [], error: 'Could not load saved items. Please try again.' }) }
    const timer = setTimeout(failed, 15000)
    const stop = onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, snap => {
      if (!active || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return
      clearTimeout(timer)
      try {
        if (!snap.exists()) { failed(); return }
        const ids = savedItemIds(snap.data().savedListings)
        setSavedState(previous => previous?.uid === uid && !previous.error && JSON.stringify(previous.ids) === JSON.stringify(ids) ? previous : { uid, ids, error: '' })
      } catch { failed() }
    }, () => { clearTimeout(timer); failed() })
    return () => { active = false; clearTimeout(timer); stop() }
  }, [user?.uid, user?.emailVerified, savedRetry])

  const logout = () => signOut(auth)
  const setListingSaved = async (listingId, saved) => {
    if (!user?.emailVerified || savedLoading || savedError) throw Error('Wait for your saved items to load, then try again.')
    if (saved && !savedListings.includes(listingId) && savedListings.length >= MAX_SAVED_ITEMS) throw Error('You can save up to 200 listings. Remove one to save another.')
    await writeSavedItem(marketApi, user.uid, listingId, saved)
  }

  if (closedUser) return <AccountClosure user={closedUser} />

  if (setupError) return <main className="p-8"><p role="alert">{setupError}</p><button onClick={() => auth.currentUser?.getIdToken(true)}>Retry account setup</button><button onClick={logout}>Log out</button></main>

  return (
    <AuthContext.Provider value={{ user, loading, logout, savedListings, savedLoading, savedError, retrySaved, setListingSaved, isModerator }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
