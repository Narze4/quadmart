// Only transport/temporary service failures may retain an already checked page.
// Permission failures, revocation and suspension must still remove private UI.
export function isTemporarySessionFailure(error) {
  if (error?.status) return error.status === 429 || error.status >= 500;
  if (error?.code) return new Set([
    'auth/network-request-failed', 'unavailable', 'deadline-exceeded',
    'aborted', 'resource-exhausted',
  ]).has(error.code);
  return error instanceof Error;
}
