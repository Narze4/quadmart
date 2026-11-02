export function createClosureRunner({ currentUser, callApi, deleteLogin }) {
  const running = new Map();
  return function finishAccountClosure() {
    const user = currentUser();
    if (!user) return Promise.reject(new Error('Sign in again to finish account deletion.'));
    if (running.has(user.uid)) return running.get(user.uid);
    const checkIdentity = () => {
      if (currentUser()?.uid !== user.uid) throw new Error('The signed-in account changed. Sign in again to continue deletion.');
    };
    const job = (async () => {
      for (let batch = 0; batch < 20; batch++) {
        checkIdentity();
        const status = await callApi('accountCloseStep');
        if (status.readyForAuthDeletion) {
          checkIdentity();
          await deleteLogin(user);
          return;
        }
      }
      throw new Error('Your account is closed. More cleanup remains; select Continue deletion to resume.');
    })().finally(() => running.delete(user.uid));
    running.set(user.uid, job);
    return job;
  };
}
