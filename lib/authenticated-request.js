import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import { createSessionRequest } from './session-request.mjs'

export const authenticatedRequest = createSessionRequest({ auth, signOut })
