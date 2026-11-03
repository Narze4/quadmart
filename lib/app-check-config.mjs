// Development keeps its opt-in setting; hosted beta always requires attestation.
// Once enabled, missing/mis-scoped configuration must not fall back.
export function appCheckConfig({ enabled, emulators, projectId, siteKey, browser }) {
  if (browser && !emulators && projectId === 'quadmart-beta' && enabled !== 'true') throw new Error('Beta requires App Check.');
  if (!browser || emulators || enabled !== 'true') return null;
  if (!['quadmart-development', 'quadmart-beta'].includes(projectId)) throw new Error('App Check requires an isolated configured project.');
  if (typeof siteKey !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(siteKey)) {
    throw new Error('App Check requires a registered site key.');
  }
  return { siteKey, isTokenAutoRefreshEnabled: true };
}
