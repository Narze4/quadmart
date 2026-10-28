import { randomUUID } from 'node:crypto';
const operations = new Set(['profile', 'listingCreate', 'listingState', 'conversation', 'message', 'sale', 'review', 'safetyStatus', 'safetyOverview', 'blockStatus', 'block', 'report', 'moderationQueue', 'moderate']);
const dependencyCodes = new Set(['ABORTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'PERMISSION_DENIED', 'ECONNRESET', 'ETIMEDOUT']);
export function requestTrace(route, log = record => console.log(JSON.stringify(record))) {
  if (!['market', 'upload', 'photo'].includes(route)) throw new Error('Unknown telemetry route');
  const requestId = randomUUID(), started = performance.now();
  return {
    requestId,
    finish(response, { action, error } = {}) {
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('Cache-Control', 'private, no-store');
      // Explicit projection only: never serialize an actor, request, exception,
      // URL, stack, body, provider response, or arbitrary operation name.
      const record = { event: 'quadmart_api', route, operation: operations.has(action) ? action : 'unknown', requestId, status: response.status, durationMs: Math.round(performance.now() - started) };
      if (response.status >= 500) record.failure = dependencyCodes.has(error?.code) ? error.code : 'internal';
      try { log(record); } catch { /* Logging failures must not alter a committed response. */ }
      return response;
    },
  };
}
