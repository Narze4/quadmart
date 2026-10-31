'use client'

import { useEffect, useRef } from 'react'

// Mount only while open. Native modality keeps background controls inert and
// keyboard navigation inside the dialog, including while its contents change.
export default function Modal({ children, labelledBy, onClose, busy = false, initialFocusRef, className = '' }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    initialFocusRef?.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [initialFocusRef])

  return <dialog
    ref={dialogRef}
    aria-labelledby={labelledBy}
    aria-busy={busy}
    className={`fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none border-0 bg-transparent text-text-primary p-0 open:flex backdrop:bg-black/40 ${className}`}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}
  >{children}</dialog>
}
