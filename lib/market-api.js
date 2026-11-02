import { authenticatedRequest } from './authenticated-request'
export async function marketApi(action,data={}, { expectedUid } = {}) {
  const response=await authenticatedRequest('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})}, { expectedUid })
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
