import { getUniversityFromEmail } from '../universities.js';
import { assertActive, SafetyError } from './safety.mjs';
import { consumeQuota, RateLimitError } from './limits.mjs';

// This read-only diagnostic is deliberately absent from local and production
// deployments. It never changes refresh intervals or issues attestation tokens.
export function developmentDiagnosticsEnabled(env) {
  return env.VERCEL_ENV === 'preview'
    && env.FIREBASE_ADMIN_PROJECT_ID === 'quadmart-development'
    && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'quadmart-development'
    && env.NEXT_PUBLIC_ENABLE_APP_CHECK === 'true'
    && env.QUADMART_LOCAL !== 'true'
    && !env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_AUTH_EMULATOR_HOST;
}

export function createSessionDiagnostics({ backend, verifyAppCheck, env = process.env, consume = consumeQuota, active = assertActive, now = Date.now }) {
  return async function POST(request) {
    const reply = (body, status = 200, extra = {}) => Response.json(body, {
      status, headers: { 'Cache-Control': 'private, no-store', ...extra },
    });
    if (!developmentDiagnosticsEnabled(env)) return reply({ error: 'Not found' }, 404);
    const bearer = request.headers.get('authorization');
    if (!bearer?.startsWith('Bearer ') || bearer.length > 16384) return reply({ error: 'Sign in required' }, 401);
    try {
      const services = backend();
      let actor;
      try { actor = await services.auth.verifyIdToken(bearer.slice(7), true); }
      catch { return reply({ error: 'Sign in again to check this session.' }, 401); }
      if (!actor.email_verified || !getUniversityFromEmail(actor.email)) return reply({ error: 'A verified university account is required.' }, 403);
      await consume(services.db, actor.uid, 'api');
      await active(services.db, services.db, actor.uid);
      const token = request.headers.get('x-firebase-appcheck');
      if (!token || token.length > 16384) return reply({ error: 'App Check evidence is missing.' }, 403);
      let claims;
      try { claims = await verifyAppCheck(services, token); }
      catch { return reply({ error: 'App Check could not be verified. Wait, then retry.' }, 403); }
      if (!env.NEXT_PUBLIC_FIREBASE_APP_ID || claims.app_id !== env.NEXT_PUBLIC_FIREBASE_APP_ID) return reply({ error: 'App Check is for another app.' }, 403);
      const checkedAt = now();
      if (![claims.iat, claims.exp, actor.iat, actor.exp, actor.auth_time].every(Number.isSafeInteger)
          || claims.iat > checkedAt / 1000 + 60 || claims.exp <= checkedAt / 1000 || claims.exp <= claims.iat) {
        return reply({ error: 'Session timing could not be verified.' }, 403);
      }
      // Only verified timestamps leave this handler. Never serialize tokens,
      // arbitrary claims, account identifiers, request headers or SDK errors.
      const iso = seconds => new Date(seconds * 1000).toISOString();
      return reply({ project: 'quadmart-development', checkedAt: new Date(checkedAt).toISOString(),
        appCheck: { issuedAt: iso(claims.iat), expiresAt: iso(claims.exp) },
        auth: { issuedAt: iso(actor.iat), expiresAt: iso(actor.exp), signedInAt: iso(actor.auth_time) },
      });
    } catch (error) {
      if (error instanceof RateLimitError) return reply({ error: 'Too many checks. Wait before retrying.' }, 429, { 'Retry-After': String(error.retryAfterSeconds) });
      if (error instanceof SafetyError) return reply({ error: 'Account access is unavailable.' }, 403);
      return reply({ error: 'Session check is temporarily unavailable. Retry when connected.' }, 503);
    }
  };
}
