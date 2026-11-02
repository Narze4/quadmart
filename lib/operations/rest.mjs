import { sourceProjects, rootName } from './backup.mjs';

export function firestoreRest({ projectId, endpoint = 'https://firestore.googleapis.com', accessToken }) {
  const cloud = sourceProjects.includes(projectId) && endpoint === 'https://firestore.googleapis.com' && projectId === 'quadmart-development';
  const local = (projectId === 'demo-quadmart' && endpoint === 'http://127.0.0.1:8080') || (projectId === 'demo-quadmart-restore' && endpoint === 'http://127.0.0.1:8180');
  if (!cloud && !local) throw new Error('Unapproved Firestore endpoint/project');
  const root = rootName(projectId);
  return async (method, resource, params = {}) => {
    if (!(resource === root || resource.startsWith(`${root}/`) || resource === `${root}:listCollectionIds` || resource === `${root}:commit`)) throw new Error('Unexpected Firestore resource');
    if (method !== 'GET' && !(method === 'POST' && (resource.endsWith(':listCollectionIds') || (local && projectId === 'demo-quadmart-restore' && resource === `${root}:commit`)))) throw new Error('Unapproved snapshot operation');
    const suffix = method === 'POST' ? resource.slice(resource.lastIndexOf(':')) : '';
    const base = suffix ? resource.slice(0, -suffix.length) : resource;
    const url = new URL(`${endpoint}/v1/${base.split('/').map(encodeURIComponent).join('/')}${suffix}`);
    if (method === 'GET') for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cloud ? await accessToken() : 'owner'}` }, ...(method === 'POST' ? { body: JSON.stringify(params) } : {}), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Firestore snapshot request failed (${response.status})`);
    return response.json();
  };
}
