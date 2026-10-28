import { MarketError, operate } from './market.mjs';
import { SafetyError } from './safety.mjs';
import { RateLimitError, consumeQuota } from './limits.mjs';
import { requestTrace } from './telemetry.mjs';
import { getUniversityFromEmail } from '../universities.js';

export function createMarketHandler({ backend, run = operate, consume = consumeQuota, log }) {
  return async function POST(request) {
    const trace = requestTrace('market', log);
    let action;
    const reply = (body, status = 200, error) => {
      const headers = {};
      if (error instanceof RateLimitError) {
        headers['Retry-After'] = String(error.retryAfterSeconds);
        body.retryAfterSeconds = error.retryAfterSeconds;
      }
      return trace.finish(Response.json({ ...body, requestId: trace.requestId }, { status, headers }), { action, error });
    };
    try {
      const bearer = request.headers.get('authorization');
      if (!bearer?.startsWith('Bearer ')) return reply({ error: 'Sign in required' }, 401);
      const { auth, db } = backend();
      let actor;
      try { actor = await auth.verifyIdToken(bearer.slice(7), true); }
      catch { return reply({ error: 'Invalid or expired sign-in' }, 401); }
      if (!actor.email_verified || !getUniversityFromEmail(actor.email)) return reply({ error: 'A verified supported university email is required' }, 403);
      // Count verified API attempts, including malformed/rejected business requests.
      // Separate transaction: operation quotas below count only committed changes.
      await consume(db, actor.uid, 'api');
      if (Number(request.headers.get('content-length')) > 12000) return reply({ error: 'Request too large' }, 413);
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'Invalid request' }, 400);
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 12000) { await reader.cancel(); return reply({ error: 'Request too large' }, 413); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')); }
      catch { return reply({ error: 'Invalid JSON' }, 400); }
      if (!body || typeof body.data !== 'object' || !body.data || Array.isArray(body.data)) return reply({ error: 'Invalid request' }, 400);
      action = body.action;
      return reply(await run(db, actor, action, body.data));
    } catch (error) {
      if (error instanceof MarketError || error instanceof SafetyError || error instanceof RateLimitError) return reply({ error: error.message }, error.status, error);
      return reply({ error: `Unable to complete this action. Please retry. Reference: ${trace.requestId}` }, 500, error);
    }
  };
}
