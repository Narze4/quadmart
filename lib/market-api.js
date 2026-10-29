import { auth } from './firebase'
export async function marketApi(action,data={}, { expectedUid } = {}) {
  const currentUser = auth.currentUser
  if(!currentUser) throw new Error('Sign in required')
  if(expectedUid && currentUser.uid !== expectedUid) throw new Error('Your account changed. Please reload this page.')
  const token=await currentUser.getIdToken()
  if(auth.currentUser?.uid !== currentUser.uid) throw new Error('Your account changed. Please reload this page.')
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
