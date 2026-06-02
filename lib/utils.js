const UNIVERSITY_MAP = {
  'emory.edu': 'Emory University',
  'gatech.edu': 'Georgia Tech',
  'uga.edu': 'University of Georgia',
  'gsu.edu': 'Georgia State University',
  'ksu.edu': 'Kennesaw State University',
  'scad.edu': 'SCAD',
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
