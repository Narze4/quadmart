export const UNIVERSITIES = [
  { name: 'Emory University', city: 'Atlanta, GA', domain: 'emory.edu' },
  { name: 'University of Georgia', city: 'Athens, GA', domain: 'uga.edu' },
  { name: 'Georgia Institute of Technology', city: 'Atlanta, GA', domain: 'gatech.edu' },
  { name: 'SCAD University', city: 'Savannah, GA', domain: 'scad.edu' },
  { name: 'Georgia State University', city: 'Atlanta, GA', domain: 'gsu.edu' },
  { name: 'Kennesaw State University', city: 'Kennesaw, GA', domain: 'kennesaw.edu' },
  { name: 'University of Tennessee', city: 'Knoxville, TN', domain: 'utk.edu' },
]

export function getUniversityFromEmail(email) {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return UNIVERSITIES.find(u => domain === u.domain || domain.endsWith(`.${u.domain}`)) ?? null
}
