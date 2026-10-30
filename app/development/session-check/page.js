import { notFound } from 'next/navigation'
import { developmentDiagnosticsEnabled } from '@/lib/server/session-diagnostics.mjs'
import SessionCheck from './session-check'

export const dynamic = 'force-dynamic'
export default function SessionCheckPage() {
  if (!developmentDiagnosticsEnabled(process.env)) notFound()
  return <SessionCheck />
}
