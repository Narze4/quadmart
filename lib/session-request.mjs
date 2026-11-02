const invalidSessionCodes = new Set(['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found']);
const sessionError = () => Object.assign(new Error('Your session ended. Please sign in again.'), { status: 401 });
const changedAccount = () => new Error('Your account changed. Please reload this page.');

// One attempt only: replaying a rejected write could duplicate a trade or upload.
export function createSessionRequest({ auth, signOut, fetch: send = fetch }) {
  return async function sessionRequest(url, options = {}, { expectedUid } = {}) {
    const user = auth.currentUser;
    if (!user) throw sessionError();
    if (expectedUid && user.uid !== expectedUid) throw changedAccount();
    let token;
    try { token = await user.getIdToken(); }
    catch (error) {
      if (!invalidSessionCodes.has(error?.code)) throw new Error('Could not refresh your sign-in. Check your connection and try again.');
      if (auth.currentUser === user) await signOut(auth);
      throw sessionError();
    }
    if (auth.currentUser !== user) throw changedAccount();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await send(url, { ...options, headers });
    if (auth.currentUser !== user) throw changedAccount();
    if (response.status === 401) {
      // A late response must not sign out an account that has already renewed.
      let currentToken;
      try { currentToken = await user.getIdToken(); }
      catch (error) { if (!invalidSessionCodes.has(error?.code)) throw new Error('Could not check your sign-in. Check your connection and try again.'); }
      if (auth.currentUser === user && (!currentToken || currentToken === token)) await signOut(auth);
      throw sessionError();
    }
    return response;
  };
}
