import { getUniversityFromEmail } from './universities'

export function getUniversity(email) { return getUniversityFromEmail(email)?.name ?? 'Your University' }
export function getCampusId(email) { return getUniversityFromEmail(email)?.domain ?? '' }

export function getUsername(user) {
  if (!user) return 'Student'
  if (user.displayName) return user.displayName
  return user.email.split('@')[0]
}

export function getDomain(email) {
  if (!email) return ''
  return email.split('@')[1] ?? ''
}

export function getListingStatus(listing) {
  return listing?.status ?? 'active'
}

export function timeAgo(ts) {
  if (!ts) return ''
  const secs = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}
