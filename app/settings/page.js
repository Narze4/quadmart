'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { auth } from '@/lib/firebase'
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import Navbar from '@/components/Navbar'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">{title}</h2>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [displayName, setDisplayName] = useState(undefined)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  const currentDisplayName = displayName !== undefined ? displayName : (user?.displayName ?? '')

  const handleUpdateName = async (e) => {
    e.preventDefault()
    setNameError('')
    setNameSuccess('')
    setNameSaving(true)
    try {
      await updateProfile(auth.currentUser, { displayName: currentDisplayName.trim() })
      setNameSuccess('Display name updated.')
    } catch {
      setNameError('Failed to update name. Please try again.')
    } finally {
      setNameSaving(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    setPwSaving(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)
      setPwSuccess('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.')
      } else {
        setPwError('Failed to update password. Please try again.')
      }
    } finally {
      setPwSaving(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setDeleteError('')
    setDeleting(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await deleteUser(auth.currentUser)
      router.push('/')
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteError('Password is incorrect.')
      } else {
        setDeleteError('Failed to delete account. Please try again.')
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

        {/* Account info */}
        <Section title="Account">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Email</p>
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
          </div>
          <form onSubmit={handleUpdateName} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={currentDisplayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            {nameError && <p className="text-sm text-red-600">{nameError}</p>}
            {nameSuccess && <p className="text-sm text-green-700">{nameSuccess}</p>}
            <button
              type="submit"
              disabled={nameSaving}
              className="self-start px-5 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {nameSaving ? 'Saving…' : 'Save Name'}
            </button>
          </form>
        </Section>

        {/* Change password */}
        <Section title="Change Password">
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-700">{pwSuccess}</p>}
            <button
              type="submit"
              disabled={pwSaving}
              className="self-start px-5 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone">
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete account</p>
                <p className="text-xs text-gray-500 mt-0.5">Permanently remove your account. This cannot be undone.</p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-3">
              <p className="text-sm text-gray-700">
                Enter your password to confirm deletion. <strong>This cannot be undone.</strong>
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                required
                className="w-full px-4 py-2.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={deleting}
                  className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
                  className="px-5 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </Section>
      </main>
    </div>
  )
}

