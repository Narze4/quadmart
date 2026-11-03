// Missing policy preserves protected development behavior, but denies beta.
// Unknown/incomplete policies never open access in either environment.
export const BETA_ACCESS_MESSAGE = 'This Emory beta is invitation-only. Ask the QuadMart team to approve your account, then retry account setup.';
export const betaPolicyRequired = projectId => projectId === 'quadmart-beta';
export function validBetaPolicy(policy) {
  return policy?.mode === 'invite-only' && policy.campusId === 'emory.edu';
}
export function betaAccessAllowed(policy, membership, campusId, projectId) {
  if (policy === null) return !betaPolicyRequired(projectId);
  return validBetaPolicy(policy) && campusId === policy.campusId
    && membership?.active === true && membership.campusId === policy.campusId;
}
