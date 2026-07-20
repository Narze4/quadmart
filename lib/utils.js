const UNIVERSITY_MAP = {
  'emory.edu': 'Emory University',
  'gatech.edu': 'Georgia Institute of Technology',
  'uga.edu': 'University of Georgia',
  'gsu.edu': 'Georgia State University',
  'ksu.edu': 'Kennesaw State University',
  'scad.edu': 'SCAD University',
  'utk.edu': 'University of Tennessee',
  'spelman.edu': 'Spelman College',
  'morehouse.edu': 'Morehouse College',
  'georgiasouthern.edu': 'Georgia Southern University',
  'mercer.edu': 'Mercer University',
  'agnesscott.edu': 'Agnes Scott College',
  'westga.edu': 'University of West Georgia',
  'augusta.edu': 'Augusta University',
  'valdosta.edu': 'Valdosta State University',
  'clayton.edu': 'Clayton State University',
  'columbusstate.edu': 'Columbus State University',
}

export function getUniversity(email) {
  if (!email) return 'Your University'
  const domain = email.split('@')[1] ?? ''
  return UNIVERSITY_MAP[domain] ?? 'Your University'
}

export function getUsername(user) {
  if (!user) return 'Student'
  if (user.displayName) return user.displayName
  return user.email.split('@')[0]
}

export function getDomain(email) {
  if (!email) return ''
  return email.split('@')[1] ?? ''
}

export function timeAgo(ts) {
  if (!ts) return ''
  const secs = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}
