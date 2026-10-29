export const MIN_PASSWORD_LENGTH = 12;
export function authErrorMessage(error, action = 'signup') {
  if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes before trying again.';
  if (error?.code === 'auth/network-request-failed') return 'Could not connect. Check your connection before trying again.';
  if (['auth/invalid-app-credential', 'auth/missing-app-credential', 'auth/app-check-token-is-invalid', 'auth/firebase-app-check-token-is-invalid', 'auth/captcha-check-failed'].includes(error?.code)) {
    return 'The security check could not finish. Reload this page and try again.';
  }
  if (action === 'signup') {
    if (['auth/weak-password', 'auth/password-does-not-meet-requirements'].includes(error?.code)) return 'Use a password with at least 12 characters that meets the password requirements.';
    if (error?.code === 'auth/invalid-email') return 'Please enter a valid university email address.';
    return 'Could not create this account. Try logging in or resetting your password.';
  }
  if (action === 'reset') return 'Could not request a reset email. Please try again later.';
  return 'Invalid email or password. Please try again.';
}
