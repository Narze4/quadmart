import { auth } from './firebase'
export async function marketApi(action,data={}) {
  if(!auth.currentUser) throw new Error('Sign in required')
  const token=await auth.currentUser.getIdToken()
  const response=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,data})})
  const result=await response.json()
  if(!response.ok) throw new Error(result.error ?? 'Request failed')
  return result
}
