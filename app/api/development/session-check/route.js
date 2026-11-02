import { getAppCheck } from 'firebase-admin/app-check'
import { backend } from '@/lib/server/firebase-admin.mjs'
import { createSessionDiagnostics } from '@/lib/server/session-diagnostics.mjs'

export const runtime = 'nodejs'
export const POST = createSessionDiagnostics({
  backend,
  verifyAppCheck: (services, token) => getAppCheck(services.auth.app).verifyToken(token),
})
