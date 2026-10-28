import { auth } from './firebase'
export async function marketApi(action,data={}) {
  if(!auth.currentUser) throw new Error('Sign in required')
  const token=await auth.currentUser.getIdToken()
  const response=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,data})})
  let result
  try { result=await response.json() }
  catch { throw new Error('The server is temporarily unavailable. Please try again.') }
  if(!response.ok) {
    const error = new Error(result.error ?? 'Request failed')
    error.status = response.status
    error.requestId = result.requestId
    error.retryAfterSeconds = result.retryAfterSeconds
    throw error
  }
  return result
}
