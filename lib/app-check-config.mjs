// Keep attestation opt-in until the development provider is registered and
// verified. Once enabled, missing/mis-scoped configuration must not fall back.
export function appCheckConfig({ enabled, emulators, projectId, siteKey, browser }) {
  if (!browser || emulators || enabled !== 'true') return null;
  if (projectId !== 'quadmart-development') throw new Error('App Check is configured only for development.');
  if (typeof siteKey !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(siteKey)) {
    throw new Error('App Check requires a registered development site key.');
  }
  return { siteKey, isTokenAutoRefreshEnabled: true };
}
